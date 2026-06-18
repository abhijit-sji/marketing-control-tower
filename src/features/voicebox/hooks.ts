import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as api from '@/Api/voiceboxApi';
import type { VoiceProfileCreate, GenerationRequest, StoryCreate } from './types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const voiceboxKeys = {
  all: ['voicebox'] as const,
  profiles: () => [...voiceboxKeys.all, 'profiles'] as const,
  profile: (id: string) => [...voiceboxKeys.profiles(), id] as const,
  presets: (engine: string) => [...voiceboxKeys.all, 'presets', engine] as const,
  generation: (id: string) => [...voiceboxKeys.all, 'generation', id] as const,
  history: () => [...voiceboxKeys.all, 'history'] as const,
  stories: () => [...voiceboxKeys.all, 'stories'] as const,
  story: (id: string) => [...voiceboxKeys.stories(), id] as const,
};

// ─── Profile hooks ────────────────────────────────────────────────────────────

export const useVoiceProfiles = () =>
  useQuery({
    queryKey: voiceboxKeys.profiles(),
    queryFn: api.listProfiles,
    staleTime: 30_000,
  });

export const useCreateProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (body: VoiceProfileCreate) => api.createProfile(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.profiles() });
      toast({ title: 'Voice profile created' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create voice profile', description: err.message, variant: 'destructive' });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: VoiceProfileCreate }) =>
      api.updateProfile(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.profiles() });
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.profile(id) });
      toast({ title: 'Voice profile updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update voice profile', description: err.message, variant: 'destructive' });
    },
  });
};

export const useDeleteProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.profiles() });
      toast({ title: 'Voice profile deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete voice profile', description: err.message, variant: 'destructive' });
    },
  });
};

export const useAddProfileSample = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      profileId,
      file,
      referenceText,
    }: {
      profileId: string;
      file: File;
      referenceText?: string;
    }) => api.addProfileSample(profileId, file, referenceText),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.profiles() });
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.profile(profileId) });
      toast({ title: 'Sample uploaded successfully' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to upload sample', description: err.message, variant: 'destructive' });
    },
  });
};

export const usePresetVoices = (engine: string, enabled = true) =>
  useQuery({
    queryKey: voiceboxKeys.presets(engine),
    queryFn: () => api.getPresetVoices(engine),
    enabled: enabled && !!engine,
    staleTime: 5 * 60_000, // presets rarely change
  });

// ─── Generation hooks ─────────────────────────────────────────────────────────

export const useGenerateSpeech = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (body: GenerationRequest) => api.generateSpeech(body),
    onSuccess: () => {
      // Invalidate history after a short delay to allow server to commit
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: voiceboxKeys.history() });
      }, 1500);
    },
    onError: (err: Error) => {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });
};

// All statuses that mean the generation is still in progress
const IN_PROGRESS_STATUSES = new Set([
  'processing',
  'loading_model',
  'generating',  // VoiceBox uses this during active inference
  'queued',
]);

/** Polls a generation's status until it reaches a terminal state. */
export const useGenerationStatus = (id: string | null, enabled = true) =>
  useQuery({
    queryKey: voiceboxKeys.generation(id ?? ''),
    queryFn: () => api.getGenerationStatus(id!),
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || IN_PROGRESS_STATUSES.has(status)) return 2000;
      return false;
    },
    staleTime: 0,
  });

// ─── History hooks ────────────────────────────────────────────────────────────

export const useHistory = (limit = 100) =>
  useQuery({
    queryKey: voiceboxKeys.history(),
    queryFn: () => api.listHistory(limit),
    staleTime: 15_000,
  });

export const useDeleteGeneration = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.deleteGeneration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.history() });
      toast({ title: 'Generation deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete generation', description: err.message, variant: 'destructive' });
    },
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.toggleFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.history() });
    },
  });
};

// ─── Story hooks ──────────────────────────────────────────────────────────────

export const useStories = () =>
  useQuery({
    queryKey: voiceboxKeys.stories(),
    queryFn: api.listStories,
    staleTime: 30_000,
  });

export const useStoryDetail = (id: string | null) =>
  useQuery({
    queryKey: voiceboxKeys.story(id ?? ''),
    queryFn: () => api.getStoryDetail(id!),
    enabled: !!id,
    staleTime: 15_000,
  });

export const useCreateStory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (body: StoryCreate) => api.createStory(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.stories() });
      toast({ title: 'Story created' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create story', description: err.message, variant: 'destructive' });
    },
  });
};

export const useUpdateStory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: StoryCreate }) =>
      api.updateStory(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.stories() });
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(id) });
      toast({ title: 'Story updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update story', description: err.message, variant: 'destructive' });
    },
  });
};

export const useDeleteStory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.deleteStory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.stories() });
      toast({ title: 'Story deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete story', description: err.message, variant: 'destructive' });
    },
  });
};

export const useAddStoryItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ storyId, generationId }: { storyId: string; generationId: string }) =>
      api.addStoryItem(storyId, generationId),
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(storyId) });
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.stories() });
      toast({ title: 'Narration added to story' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add to story', description: err.message, variant: 'destructive' });
    },
  });
};

export const useRemoveStoryItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ storyId, itemId }: { storyId: string; itemId: string }) =>
      api.removeStoryItem(storyId, itemId),
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(storyId) });
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.stories() });
      toast({ title: 'Item removed from story' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to remove item', description: err.message, variant: 'destructive' });
    },
  });
};

export const useReorderStoryItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ storyId, generationIds }: { storyId: string; generationIds: string[] }) =>
      api.reorderStoryItems(storyId, generationIds),
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(storyId) });
    },
  });
};

export const useSetStoryItemVolume = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ storyId, itemId, volume }: { storyId: string; itemId: string; volume: number }) =>
      api.setStoryItemVolume(storyId, itemId, volume),
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(storyId) });
    },
  });
};

export const useDuplicateStoryItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ storyId, itemId }: { storyId: string; itemId: string }) =>
      api.duplicateStoryItem(storyId, itemId),
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(storyId) });
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.stories() });
      toast({ title: 'Narration duplicated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to duplicate', description: err.message, variant: 'destructive' });
    },
  });
};

export const useTrimStoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      storyId,
      itemId,
      trimStartMs,
      trimEndMs,
    }: { storyId: string; itemId: string; trimStartMs: number; trimEndMs: number }) =>
      api.trimStoryItem(storyId, itemId, trimStartMs, trimEndMs),
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: voiceboxKeys.story(storyId) });
    },
  });
};
