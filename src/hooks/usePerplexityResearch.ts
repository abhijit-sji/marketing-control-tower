import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


export interface ResearchResult {
  topic_summary: string;
  key_points: string[];
  content_angles: { angle: string; description: string }[];
  trending_aspects: string[];
  target_audience_insights: string;
  suggested_headline: string;
}

export interface ScrapeResult {
  title: string;
  summary: string;
  key_takeaways: string[];
  quotes: string[];
  content_type: string;
  relevance_tags: string[];
  content_date: string | null;
}

export interface PerplexityResearchResponse {
  ok: boolean;
  research?: ResearchResult;
  citations?: string[];
  execution_time_ms?: number;
  saved_trend?: any;
  error?: string;
}

export interface PerplexityScrapeResponse {
  ok: boolean;
  scrape?: ScrapeResult;
  source_url?: string;
  execution_time_ms?: number;
  saved_upload?: any;
  error?: string;
}

export const usePerplexityResearch = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      topic,
      saveToTrends = false,
    }: {
      topic: string;
      saveToTrends?: boolean;
    }): Promise<PerplexityResearchResponse> => {
      const { data, error } = await supabase.functions.invoke("perplexity-test", {
        body: {
          action: "research",
          topic,
          leader_id: leaderId,
          save_to_trends: saveToTrends,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.saveToTrends && data.saved_trend) {
        queryClient.invalidateQueries({ queryKey: ["linkedin", "leaders", leaderId, "trends"] });
        toast({
          title: "Research saved",
          description: "Topic added to weekly trends",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Research failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const usePerplexityScrape = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      url,
      saveToUploads = false,
    }: {
      url: string;
      saveToUploads?: boolean;
    }): Promise<PerplexityScrapeResponse> => {
      const { data, error } = await supabase.functions.invoke("perplexity-test", {
        body: {
          action: "scrape",
          url,
          leader_id: leaderId,
          save_to_uploads: saveToUploads,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.saveToUploads && data.saved_upload) {
        queryClient.invalidateQueries({ queryKey: ["linkedin", "leaders", leaderId, "uploads"] });
        toast({
          title: "URL analyzed",
          description: "Content added to knowledge docs",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Scrape failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTrendStatus = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      trendId,
      status,
    }: {
      trendId: string;
      status: "draft" | "ready" | "in_progress" | "used";
    }) => {
      const { data, error } = await (supabase as any)
        .from("weekly_trends")
        .update({ status })
        .eq("id", trendId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin", "leaders", leaderId, "trends"] });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTrend = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (trendId: string) => {
      const { error } = await (supabase as any)
        .from("weekly_trends")
        .delete()
        .eq("id", trendId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin", "leaders", leaderId, "trends"] });
      toast({ title: "Topic deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete topic",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useReadyTrends = (leaderId?: string) => {
  return useMutation({
    mutationFn: async () => {
      if (!leaderId) throw new Error("Leader ID required");
      
      const { data, error } = await (supabase as any)
        .from("weekly_trends")
        .select("*")
        .eq("leader_id", leaderId)
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};
