import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AgentExecutionContext = {
  user_id: string;
  timeframe?: string;
  filters?: unknown;
  office_ids?: string[];
} & Record<string, unknown>;

interface AgentRunRequest {
  agent_id: string;
  execution_context: AgentExecutionContext;
}

interface ProviderMeta {
  provider: string;
  version: string;
  api_model: string;
  response_time_ms: number;
  total_tokens: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

interface DataSourcesUsed {
  knowledge_base: boolean;
  analytics: boolean;
  kpis: boolean;
  brand_info: boolean;
}

interface AgentRunResponse {
  success?: boolean;
  run_id?: string;
  summary?: string;
  tasks_created?: number;
  provider_meta?: ProviderMeta;
  data_sources_used?: DataSourcesUsed;
  suggestions?: Array<{
    text: string;
    confidence?: number;
  }>;
  [key: string]: unknown;
}

export function useRunAIAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: AgentRunRequest): Promise<AgentRunResponse> => {
      const { data, error } = await supabase.functions.invoke('run-ai-agent', {
        body: payload
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['ai-agent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-control', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-control', 'metrics'] });
    }
  });
}
