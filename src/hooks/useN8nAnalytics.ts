import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsData {
  date: string;
  totalUsers: string;
  screenPageViews: string;
  active1DayUsers: string;
}

export const useN8nAnalytics = () => {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Get the n8n workflow config for analytics
      const { data: workflowConfig, error: configError } = await supabase
        .from("n8n_workflow_configs")
        .select("*")
        .eq("workflow_slug", "google-analytics")
        .eq("is_enabled", true)
        .single();

      if (configError || !workflowConfig) {
        throw new Error("N8n workflow not configured or disabled");
      }

      // Call the n8n workflow
      const webhookUrl = `${workflowConfig.base_url}`;
      
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "fetch_analytics",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analytics from n8n");
      }

      const analyticsData = await response.json();
      setData(analyticsData);

      toast({
        title: "Success",
        description: "Analytics data fetched successfully",
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    data,
    isLoading,
    fetchAnalytics,
  };
};
