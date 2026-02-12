/**
 * React Query hooks for Hero Section Optimizer
 *
 * Provides hooks for generating hero sections and fetching generation history.
 * Note: These hooks rely on the hero-section-optimizer edge function.
 * The database tables for history are not yet created, so history functions return empty arrays.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  HeroSectionInput,
  HeroSectionResult,
  HeroSectionError,
  HeroSectionGeneration,
  HeroSectionGenerationLog,
} from '@/types/hero-optimizer';

/**
 * Hook to generate a new hero section
 *
 * Usage:
 * const generateHero = useHeroSectionOptimizer();
 * generateHero.mutate(input);
 */
export function useHeroSectionOptimizer() {
  const queryClient = useQueryClient();

  return useMutation<HeroSectionResult, Error, HeroSectionInput>({
    mutationFn: async (input: HeroSectionInput) => {
      const { data, error } = await supabase.functions.invoke('hero-section-optimizer', {
        body: input,
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate hero section');
      }

      if (!data.success) {
        const errorData = data as HeroSectionError;
        throw new Error(errorData.error || 'Generation failed');
      }

      return data as HeroSectionResult;
    },
    onSuccess: () => {
      // Invalidate history queries to refetch with new generation
      queryClient.invalidateQueries({ queryKey: ['hero-section-history'] });
    },
  });
}

/**
 * Hook to fetch user's hero section generation history
 * Note: Returns empty array until hero_section_generations table is created
 *
 * Usage:
 * const { data: history, isLoading } = useHeroSectionHistory(brandId);
 */
export function useHeroSectionHistory(brandId?: string) {
  return useQuery({
    queryKey: ['hero-section-history', brandId],
    queryFn: async (): Promise<HeroSectionGeneration[]> => {
      // Table not yet created - return empty for now
      console.log('[useHeroSectionHistory] Hero section tables not yet created');
      return [];
    },
    enabled: true,
  });
}

/**
 * Hook to fetch a single hero section generation by ID
 * Note: Returns null until hero_section_generations table is created
 *
 * Usage:
 * const { data: generation, isLoading } = useHeroSectionDetails(heroId);
 */
export function useHeroSectionDetails(heroId: string) {
  return useQuery({
    queryKey: ['hero-section-details', heroId],
    queryFn: async (): Promise<HeroSectionGeneration | null> => {
      // Table not yet created - return null for now
      console.log('[useHeroSectionDetails] Hero section tables not yet created');
      return null;
    },
    enabled: Boolean(heroId),
  });
}

/**
 * Hook to fetch execution logs for a hero section generation
 * Note: Returns empty array until hero_section_generation_logs table is created
 *
 * Usage:
 * const { data: logs, isLoading } = useHeroSectionLogs(heroId);
 */
export function useHeroSectionLogs(heroId: string) {
  return useQuery({
    queryKey: ['hero-section-logs', heroId],
    queryFn: async (): Promise<HeroSectionGenerationLog[]> => {
      // Table not yet created - return empty for now
      console.log('[useHeroSectionLogs] Hero section tables not yet created');
      return [];
    },
    enabled: Boolean(heroId),
  });
}

/**
 * Hook to delete a hero section generation
 * Note: No-op until hero_section_generations table is created
 *
 * Usage:
 * const deleteHero = useDeleteHeroSection();
 * deleteHero.mutate(heroId);
 */
export function useDeleteHeroSection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (heroId: string) => {
      // Table not yet created - no-op for now
      console.log('[useDeleteHeroSection] Hero section tables not yet created, skipping delete for:', heroId);
    },
    onSuccess: () => {
      // Invalidate history queries to refetch without deleted generation
      queryClient.invalidateQueries({ queryKey: ['hero-section-history'] });
    },
  });
}

/**
 * Hook to get generation statistics for a user
 * Note: Returns placeholder stats until hero_section_generations table is created
 *
 * Usage:
 * const { data: stats } = useHeroSectionStats();
 */
export function useHeroSectionStats() {
  return useQuery({
    queryKey: ['hero-section-stats'],
    queryFn: async () => {
      // Table not yet created - return empty stats for now
      console.log('[useHeroSectionStats] Hero section tables not yet created');
      return {
        total_generations: 0,
        avg_confidence_score: 0,
        avg_attempts: 0,
        strategy_distribution: {},
        most_used_strategy: 'none',
      };
    },
    enabled: true,
  });
}
