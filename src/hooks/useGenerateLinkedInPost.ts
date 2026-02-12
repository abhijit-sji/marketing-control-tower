import { useQuery } from "@tanstack/react-query";
import { useRunAIAgent } from "./useRunAIAgent";
import { supabase } from "@/integrations/supabase/client";
import { GeneratePostInput } from "@/features/linkedin-content/types";

export const useGenerateLinkedInPost = (leaderId?: string) => {
  const runAgent = useRunAIAgent();
  
  // Fetch LinkedIn agent ID
  const { data: agentData } = useQuery({
    queryKey: ['linkedin-agent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('slug', 'linkedin-content-gen')
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  return {
    mutate: async (payload: GeneratePostInput) => {
      if (!agentData?.id) throw new Error('LinkedIn agent not configured');
      
      // Map payload to agent execution context
      return runAgent.mutateAsync({
        agent_id: agentData.id,
        execution_context: {
          leader_id: leaderId,
          source_type: payload.sourceType,
          source_id: payload.sourceId,
          custom_content: payload.customContent,
          headline_idea: payload.headlineIdea,
          call_to_action: payload.callToAction,
          influencer_styles: payload.influencerStyles || [],
          model: payload.model || 'gpt-5-mini-2025-08-07',
          user_id: 'system'
        }
      });
    },
    mutateAsync: async (payload: GeneratePostInput) => {
      if (!agentData?.id) throw new Error('LinkedIn agent not configured');
      
      return runAgent.mutateAsync({
        agent_id: agentData.id,
        execution_context: {
          leader_id: leaderId,
          source_type: payload.sourceType,
          source_id: payload.sourceId,
          custom_content: payload.customContent,
          headline_idea: payload.headlineIdea,
          call_to_action: payload.callToAction,
          influencer_styles: payload.influencerStyles || [],
          model: payload.model || 'gpt-5-mini-2025-08-07',
          user_id: 'system'
        }
      });
    },
    isPending: runAgent.isPending,
    isError: runAgent.isError,
    error: runAgent.error
  };
};

export type GeneratePostResponse = {
  success: boolean;
  run_id: string;
  post: {
    post_title: string;
    post_body: string;
    carousel_outline?: string[];
    caption_ideas?: string[];
  };
  meta: {
    model_used: string;
    tokens_used: number;
    generation_time_ms: number;
  };
};
