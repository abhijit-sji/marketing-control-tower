import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderAnalytics {
  id: string;
  posted_date: string | null;
  post_type: string | null;
  hook_style: string | null;
  impressions: number;
  engagement_score: number;
  reach_count: number;
  conversion_actions: number;
  comment_quality_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  totalPosts: number;
  avgEngagement: number;
  avgImpressions: number;
  topPostType: string | null;
  topHookStyle: string | null;
  totalReach: number;
  byAudience: Record<string, {
    posts: number;
    avgEngagement: number;
    avgImpressions: number;
  }>;
}

export const useLeaderAnalytics = (leaderId: string | undefined) => {
  return useQuery({
    queryKey: ['leader-analytics', leaderId],
    queryFn: async () => {
      if (!leaderId) return [];
      
      const { data, error } = await supabase
        .from('content_performance_metrics')
        .select('*')
        .eq('leader_id', leaderId)
        .order('posted_date', { ascending: false });
      
      if (error) throw error;
      return data as LeaderAnalytics[];
    },
    enabled: !!leaderId,
  });
};

export const useAnalyticsSummary = (leaderId: string | undefined) => {
  return useQuery({
    queryKey: ['analytics-summary', leaderId],
    queryFn: async () => {
      if (!leaderId) return null;
      
      const { data, error } = await supabase
        .from('content_performance_metrics')
        .select('*')
        .eq('leader_id', leaderId);
      
      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      const totalPosts = data.length;
      const avgEngagement = data.reduce((sum, m) => sum + m.engagement_score, 0) / totalPosts;
      const avgImpressions = data.reduce((sum, m) => sum + m.impressions, 0) / totalPosts;
      const totalReach = data.reduce((sum, m) => sum + m.reach_count, 0);
      
      // Find most common post type
      const postTypes = data.reduce((acc, m) => {
        if (!m.post_type) return acc;
        acc[m.post_type] = (acc[m.post_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topPostType = Object.entries(postTypes)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
      
      // Find most common hook style
      const hookStyles = data.reduce((acc, m) => {
        if (!m.hook_style) return acc;
        acc[m.hook_style] = (acc[m.hook_style] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topHookStyle = Object.entries(hookStyles)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
      
      // Group by audience
      const byAudience = data.reduce((acc, m) => {
        const aud = m.audience || 'General';
        if (!acc[aud]) {
          acc[aud] = { posts: 0, totalEng: 0, totalImp: 0 };
        }
        acc[aud].posts++;
        acc[aud].totalEng += m.engagement_score;
        acc[aud].totalImp += m.impressions;
        return acc;
      }, {} as Record<string, { posts: number; totalEng: number; totalImp: number }>);

      const audienceStats = Object.entries(byAudience).reduce((acc, [aud, stats]) => {
        acc[aud] = {
          posts: stats.posts,
          avgEngagement: Math.round(stats.totalEng / stats.posts),
          avgImpressions: Math.round(stats.totalImp / stats.posts),
        };
        return acc;
      }, {} as Record<string, { posts: number; avgEngagement: number; avgImpressions: number }>);
      
      return {
        totalPosts,
        avgEngagement: Math.round(avgEngagement),
        avgImpressions: Math.round(avgImpressions),
        topPostType,
        topHookStyle,
        totalReach,
        byAudience: audienceStats,
      } as AnalyticsSummary;
    },
    enabled: !!leaderId,
  });
};
