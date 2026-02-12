import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

// Types for project knowledge base
export interface ProjectKnowledgeSource {
  id: string;
  project_id: string;
  name: string;
  source_type: string;
  config: Json;
  is_active: boolean | null;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectKnowledgeFile {
  id: string;
  project_id: string;
  source_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  file_type: string;
  sync_status: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  external_id: string | null;
  // New async processing fields
  name: string | null;
  path: string | null;
  processing_status: string | null;
  retry_count: number | null;
  last_error: string | null;
  error_timestamp: string | null;
  embedding_count: number | null;
  is_indexed: boolean | null;
  last_indexed: string | null;
  metadata: Json | null;
  // Join field
  project_knowledge_sources?: ProjectKnowledgeSource;
}

/**
 * Hook for managing project-specific knowledge base files
 * Mirrors useBrandKnowledgeBase but for projects
 */
export const useProjectKnowledgeBase = (projectId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch project-specific knowledge sources
  const { data: sources, isLoading: isLoadingSources } = useQuery({
    queryKey: ['project-knowledge-sources', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('project_knowledge_sources')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as ProjectKnowledgeSource[];
    },
    enabled: !!projectId,
  });

  // Fetch project-specific knowledge files
  const { data: files, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['project-knowledge-files', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('project_knowledge_files')
        .select('*, project_knowledge_sources(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProjectKnowledgeFile[];
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      // Auto-refresh every 3 seconds if any files are pending or processing
      const hasProcessingFiles = query.state.data?.some(
        file => file.processing_status === 'pending' || file.processing_status === 'processing'
      );
      return hasProcessingFiles ? 3000 : false;
    },
  });

  // Upload file mutation (uses edge function for async processing)
  const uploadFile = useMutation({
    mutationFn: async ({
      file,
      sourceId,
      fileSummary
    }: {
      file: File;
      sourceId: string;
      fileSummary?: string;
    }) => {
      if (!projectId) throw new Error('Project ID is required');
      if (!sourceId) throw new Error('Source ID is required');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('sourceId', sourceId);
      if (fileSummary) formData.append('fileSummary', fileSummary);

      const { data, error } = await supabase.functions.invoke('project-knowledge-upload', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-knowledge-files', projectId] });

      if (data?.success) {
        toast({
          title: "File uploaded",
          description: data.message || "File has been uploaded and will be processed shortly.",
        });
      } else {
        toast({
          title: "Upload completed with errors",
          description: data?.message || "File uploaded but encountered issues.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from('project_knowledge_files')
        .delete()
        .eq('id', fileId)
        .eq('project_id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-knowledge-files', projectId] });
      toast({
        title: "File deleted",
        description: "The file has been removed from the knowledge base.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete stuck/failed files mutation
  const deleteStuckFiles = useMutation({
    mutationFn: async (fileIds: string[]) => {
      if (!projectId) throw new Error('Project ID is required');
      if (!fileIds || fileIds.length === 0) throw new Error('File IDs are required');

      let deleted = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const fileId of fileIds) {
        try {
          // Get file info to delete from storage - use metadata.path if available
          const { data: file } = await supabase
            .from('project_knowledge_files')
            .select('file_url, metadata')
            .eq('id', fileId)
            .single();

          // Delete from storage if path exists in metadata
          const storagePath = (file?.metadata as Record<string, unknown>)?.path as string | undefined;
          if (storagePath) {
            await supabase.storage.from('knowledge').remove([storagePath]);
          }

          // Delete file record (embeddings are deleted via cascade or don't exist yet)
          const { error } = await supabase
            .from('project_knowledge_files')
            .delete()
            .eq('id', fileId);

          if (error) throw error;
          deleted++;
        } catch (err) {
          failed++;
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      return { deleted, failed, errors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-knowledge-files', projectId] });

      if (data.deleted > 0) {
        toast({
          title: "Files deleted",
          description: `Successfully deleted ${data.deleted} file(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
        });
      }

      if (data.failed > 0 && data.deleted === 0) {
        toast({
          title: "Delete failed",
          description: `Failed to delete ${data.failed} file(s). ${data.errors[0] || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create project-specific knowledge source
  const createSource = useMutation({
    mutationFn: async ({
      name,
      type,
      config,
    }: {
      name: string;
      type: 'manual' | 'google_drive' | 'supabase';
      config?: Record<string, unknown>;
    }) => {
      if (!projectId) throw new Error('Project ID is required');

      const { data, error } = await supabase
        .from('project_knowledge_sources')
        .insert([{
          name,
          source_type: type,
          project_id: projectId,
          config: (config || {}) as Json,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-knowledge-sources', projectId] });
      toast({
        title: "Source created",
        description: "Knowledge source has been added to your project.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete source
  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from('project_knowledge_sources')
        .update({ is_active: false })
        .eq('id', sourceId)
        .eq('project_id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-knowledge-sources', projectId] });
      toast({
        title: "Source removed",
        description: "The knowledge source has been deactivated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate statistics
  const indexedFilesCount = files?.filter(f => f.is_indexed).length || 0;
  const totalFilesCount = files?.length || 0;
  const pendingFilesCount = files?.filter(f => f.processing_status === 'pending').length || 0;
  const processingFilesCount = files?.filter(f => f.processing_status === 'processing').length || 0;
  const failedFilesCount = files?.filter(f => f.processing_status === 'failed').length || 0;

  return {
    // Data
    files,
    sources,

    // Loading states
    isLoading: isLoadingFiles || isLoadingSources,
    isLoadingFiles,
    isLoadingSources,

    // Mutations
    uploadFile,
    deleteFile,
    deleteStuckFiles,
    createSource,
    deleteSource,

    // Statistics
    indexedFilesCount,
    totalFilesCount,
    pendingFilesCount,
    processingFilesCount,
    failedFilesCount,
  };
};
