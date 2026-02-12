import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Projects Hook
export const useActiveCollabProjects = () => {
  const queryClient = useQueryClient();

  const searchProjects = useMutation({
    mutationFn: async (projectName: string) => {
      const { data, error } = await supabase.functions.invoke('activecollab-projects', {
        body: { action: 'search', projectName },
      });
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: 'Search Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const importProject = useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      const { data, error } = await supabase.functions.invoke('activecollab-projects', {
        body: { action: 'import', projectId, projectName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      const projectName = data.project?.name || 'Project';
      const isNew = data.isNew !== false; // Default to true if not specified
      
      if (isNew) {
        toast({
          title: 'Project Imported',
          description: `"${projectName}" has been imported. Syncing tasks and comments in the background...`,
        });
      } else {
        toast({
          title: 'Project Updated',
          description: `"${projectName}" has been updated. Syncing latest tasks and comments...`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getBudget = useMutation({
    mutationFn: async ({ projectId, localProjectId }: { projectId: string; localProjectId?: string }) => {
      const { data, error } = await supabase.functions.invoke('activecollab-projects', {
        body: { 
          action: 'get_budget', 
          projectId,
          filters: { localProjectId }
        },
      });
      if (error) throw error;
      return data;
    },
  });

  const syncAllProjects = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('activecollab-projects', {
        body: { action: 'sync_all' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      if (data.synced === 0) {
        toast({
          title: 'No Projects Found',
          description: data.message || 'No projects were found in ActiveCollab. Please verify your credentials and account access, or use the Search & Import dialog to add projects manually.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Projects Synced',
          description: `Successfully synced ${data.synced} project${data.synced === 1 ? '' : 's'} from ActiveCollab`,
        });
      }
    },
    onError: (error: Error) => {
      const isAuthError = error.message?.toLowerCase().includes('unauthorized') || 
                          error.message?.toLowerCase().includes('authentication');
      
      toast({
        title: isAuthError ? 'Authentication Failed' : 'Sync Failed',
        description: isAuthError ? 
          'ActiveCollab authentication failed. Please check your credentials in Admin Settings.' :
          error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    searchProjects,
    importProject,
    getBudget,
    syncAllProjects,
  };
};

// Tasks Hook
export const useActiveCollabTasks = () => {
  const queryClient = useQueryClient();

  const getTasks = useMutation({
    mutationFn: async ({ projectId, page = 1, perPage = 50 }: { 
      projectId: string; 
      page?: number; 
      perPage?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: { action: 'get_all', projectId, page, perPage },
      });
      if (error) throw error;
      return data;
    },
  });

  const getTaskComments = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: { action: 'get_comments', taskId },
      });
      if (error) throw error;
      return data;
    },
  });

  const syncTasks = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: { action: 'sync_to_local', projectId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      toast({
        title: 'Tasks Synced',
        description: `Successfully synced ${data.synced} tasks`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncAllTasks = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: { action: 'sync_all_projects' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      toast({
        title: 'All Tasks Synced',
        description: `Successfully synced ${data.synced} tasks across all projects`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    getTasks,
    getTaskComments,
    syncTasks,
    syncAllTasks,
  };
};

// Time Tracking Hook
export const useActiveCollabTimeTracking = () => {
  const getProjectHours = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('activecollab-time-tracking', {
        body: { action: 'get_project_hours', projectId },
      });
      if (error) throw error;
      return data;
    },
  });

  const syncMonthlyTimeTracking = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('activecollab-time-tracking', {
        body: { action: 'sync_monthly' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Time Tracking Synced',
        description: `Successfully updated ${data.updated} projects with time tracking data`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    getProjectHours,
    syncMonthlyTimeTracking,
  };
};

// Sync Logs Hook
export const useActiveCollabSyncLogs = () => {
  return useQuery({
    queryKey: ['activecollab-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activecollab_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });
};
