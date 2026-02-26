/**
 * React Query hooks for Reel Hook Generator
 *
 * Provides hooks for generating reel hooks and fetching generation history.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import type {
  ReelHookInput,
  ReelHookResult,
  ReelHookError,
  ReelHookGeneration,
  ReelHookGenerationLog,
  ReelHookStats,
  Platform,
  PrimaryGoal,
} from '@/types/reel-hook-generator';

/**
 * Hook to generate reel hooks
 *
 * Usage:
 * const generateHooks = useReelHookGenerator();
 * generateHooks.mutate(input);
 */
export function useReelHookGenerator() {
  const queryClient = useQueryClient();

  return useMutation<ReelHookResult, Error, ReelHookInput>({
    mutationFn: async (input: ReelHookInput) => {
      const { data, error } = await supabase.functions.invoke('reel-hook-generator', {
        body: input,
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate reel hooks');
      }

      if (!data.success) {
        const errorData = data as ReelHookError;
        throw new Error(errorData.error || 'Hook generation failed');
      }

      return data as ReelHookResult;
    },
    onSuccess: () => {
      // Invalidate history queries to refetch with new generation
      queryClient.invalidateQueries({ queryKey: ['reel-hook-history'] });
      queryClient.invalidateQueries({ queryKey: ['reel-hook-stats'] });
    },
  });
}

/**
 * Hook to fetch user's reel hook generation history
 *
 * Usage:
 * const { data: history, isLoading } = useReelHookHistory(brandId);
 */
export function useReelHookHistory(brandId?: string, limit: number = 50) {
  return useQuery({
    queryKey: ['reel-hook-history', brandId, limit],
    queryFn: async (): Promise<ReelHookGeneration[]> => {
      let query = supabase
        .from('reel_hook_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (brandId) {
        query = query.eq('brand_id', brandId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useReelHookHistory] Error fetching history:', error);
        throw error;
      }

      return (data || []) as unknown as ReelHookGeneration[];
    },
    enabled: true,
  });
}

/**
 * Hook to fetch a single reel hook generation by ID
 *
 * Usage:
 * const { data: generation, isLoading } = useReelHookDetails(generationId);
 */
export function useReelHookDetails(generationId: string) {
  return useQuery({
    queryKey: ['reel-hook-details', generationId],
    queryFn: async (): Promise<ReelHookGeneration | null> => {
      const { data, error } = await supabase
        .from('reel_hook_generations')
        .select('*')
        .eq('id', generationId)
        .maybeSingle();

      if (error) {
        console.error('[useReelHookDetails] Error fetching generation:', error);
        throw error;
      }

      return data as unknown as ReelHookGeneration | null;
    },
    enabled: Boolean(generationId),
  });
}

/**
 * Hook to fetch execution logs for a reel hook generation
 *
 * Usage:
 * const { data: logs, isLoading } = useReelHookLogs(generationId);
 */
export function useReelHookLogs(generationId: string) {
  return useQuery({
    queryKey: ['reel-hook-logs', generationId],
    queryFn: async (): Promise<ReelHookGenerationLog[]> => {
      const { data, error } = await supabase
        .from('reel_hook_generation_logs')
        .select('*')
        .eq('reel_hook_generation_id', generationId)
        .order('step_name')
        .order('attempt_number');

      if (error) {
        console.error('[useReelHookLogs] Error fetching logs:', error);
        throw error;
      }

      return (data || []) as ReelHookGenerationLog[];
    },
    enabled: Boolean(generationId),
  });
}

/**
 * Hook to delete a reel hook generation
 *
 * Usage:
 * const deleteHook = useDeleteReelHookGeneration();
 * deleteHook.mutate(generationId);
 */
export function useDeleteReelHookGeneration() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (generationId: string) => {
      const { error } = await supabase
        .from('reel_hook_generations')
        .delete()
        .eq('id', generationId);

      if (error) {
        console.error('[useDeleteReelHookGeneration] Error deleting generation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate history queries to refetch without deleted generation
      queryClient.invalidateQueries({ queryKey: ['reel-hook-history'] });
      queryClient.invalidateQueries({ queryKey: ['reel-hook-stats'] });
    },
  });
}

/**
 * Hook to get generation statistics for a user
 *
 * Usage:
 * const { data: stats } = useReelHookStats(brandId);
 */
export function useReelHookStats(brandId?: string) {
  return useQuery({
    queryKey: ['reel-hook-stats', brandId],
    queryFn: async (): Promise<ReelHookStats> => {
      let query = supabase
        .from('reel_hook_generations')
        .select('*')
        .eq('status', 'completed');

      if (brandId) {
        query = query.eq('brand_id', brandId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useReelHookStats] Error fetching stats:', error);
        throw error;
      }

      const generations = (data || []) as unknown as ReelHookGeneration[];

      if (generations.length === 0) {
        return {
          total_generations: 0,
          avg_quality_score: 0,
          avg_attempts: 0,
          platform_distribution: {} as Record<Platform, number>,
          goal_distribution: {} as Record<PrimaryGoal, number>,
          category_distribution: {},
          most_used_platform: 'instagram' as Platform,
          most_used_goal: 'views' as PrimaryGoal,
          most_used_category: 'none',
          total_cost: 0,
        };
      }

      // Calculate statistics
      const totalGenerations = generations.length;
      const avgQualityScore =
        generations.reduce((sum, g) => sum + (g.avg_quality_score || 0), 0) / totalGenerations;
      const avgAttempts =
        generations.reduce((sum, g) => sum + g.generation_attempts, 0) / totalGenerations;
      const totalCost = generations.reduce((sum, g) => sum + g.cost_usd, 0);

      // Platform distribution
      const platformDistribution = generations.reduce((acc, g) => {
        acc[g.platform] = (acc[g.platform] || 0) + 1;
        return acc;
      }, {} as Record<Platform, number>);

      const mostUsedPlatform = Object.entries(platformDistribution).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] as Platform || 'instagram';

      // Goal distribution
      const goalDistribution = generations.reduce((acc, g) => {
        acc[g.primary_goal] = (acc[g.primary_goal] || 0) + 1;
        return acc;
      }, {} as Record<PrimaryGoal, number>);

      const mostUsedGoal = Object.entries(goalDistribution).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] as PrimaryGoal || 'views';

      // Category distribution
      const categoryDistribution = generations.reduce((acc, g) => {
        const category = g.primary_hook_category;
        if (category) {
          acc[category] = (acc[category] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const mostUsedCategory = Object.entries(categoryDistribution).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] || 'curiosity';

      return {
        total_generations: totalGenerations,
        avg_quality_score: avgQualityScore,
        avg_attempts: avgAttempts,
        platform_distribution: platformDistribution,
        goal_distribution: goalDistribution,
        category_distribution: categoryDistribution,
        most_used_platform: mostUsedPlatform,
        most_used_goal: mostUsedGoal,
        most_used_category: mostUsedCategory,
        total_cost: totalCost,
      };
    },
    enabled: true,
  });
}

/**
 * Hook to get recent generations for a specific platform
 *
 * Usage:
 * const { data: recentHooks } = useReelHooksByPlatform('instagram', 10);
 */
export function useReelHooksByPlatform(platform: Platform, limit: number = 10) {
  return useQuery({
    queryKey: ['reel-hooks-by-platform', platform, limit],
    queryFn: async (): Promise<ReelHookGeneration[]> => {
      const { data, error } = await supabase
        .from('reel_hook_generations')
        .select('*')
        .eq('platform', platform)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[useReelHooksByPlatform] Error:', error);
        throw error;
      }

      return (data || []) as unknown as ReelHookGeneration[];
    },
    enabled: Boolean(platform),
  });
}
