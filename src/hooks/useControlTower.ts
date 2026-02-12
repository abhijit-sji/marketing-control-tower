import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for Control Tower project operations
 * Provides search and import functionality for Control Tower projects
 */
export const useControlTower = () => {
  const queryClient = useQueryClient();

  /**
   * Search for projects in Control Tower by name
   */
  const searchProjects = useMutation({
    mutationFn: async (projectName: string) => {
      const { data, error } = await supabase.functions.invoke('control-tower-projects', {
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

  /**
   * Import a project from Control Tower to local database
   * Updates existing project if it was previously imported
   */
  const importProject = useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      const { data, error } = await supabase.functions.invoke('control-tower-projects', {
        body: { action: 'import', projectId, projectName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate projects query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      const projectName = data.project?.name || 'Project';
      const isNew = data.isNew !== false; // Default to true if not specified

      if (isNew) {
        toast({
          title: 'Project Imported',
          description: `"${projectName}" has been imported successfully from Control Tower.`,
        });
      } else {
        toast({
          title: 'Project Updated',
          description: `"${projectName}" has been updated with the latest data from Control Tower.`,
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

  return {
    searchProjects,
    importProject,
  };
};
