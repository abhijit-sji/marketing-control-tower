import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface PromptCoachAgentProps {
  prompt: string;
  onPromptImproved: (improvedPrompt: string) => void;
  disabled?: boolean;
}

export function PromptCoachAgent({ prompt, onPromptImproved, disabled }: PromptCoachAgentProps) {
  const [improvedData, setImprovedData] = useState<any>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const { toast } = useToast();
  const runAgent = useRunAIAgent();

  // Fetch the agent ID by slug on mount
  useEffect(() => {
    const fetchAgent = async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id")
        .eq("slug", "gemini-prompt-coach")
        .eq("is_enabled", true)
        .single();
      
      if (error) {
        console.error("Failed to fetch Gemini Prompt Coach agent:", error);
        return;
      }
      
      if (data) {
        setAgentId(data.id);
      }
    };
    
    fetchAgent();
  }, []);

  const handleImprovePrompt = async () => {
    if (!agentId) {
      toast({
        title: "Agent not ready",
        description: "The Prompt Coach agent is not available yet",
        variant: "destructive",
      });
      return;
    }

    if (!prompt || prompt.trim().length < 5) {
      toast({
        title: "Prompt too short",
        description: "Please enter at least 5 characters before improving",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await runAgent.mutateAsync({
        agent_id: agentId, // Use the fetched UUID
        execution_context: {
          user_id: "", // Will be populated by the edge function from auth
          prompt: prompt,
          context: "gemini_image_generation",
        },
      });

      // Parse the AI response
      let parsedResult;
      try {
        // The AI response might be in ai_summary or summary field
        const responseText = String(result.summary || result.ai_summary || "");
        
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, try direct parse
          parsedResult = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        // Fallback: treat the entire response as improved prompt
        parsedResult = {
          improved_prompt: String(result.summary || result.ai_summary || prompt),
          changes_made: ["Automated improvements applied"],
          suggestions: [],
          confidence_score: 0.5,
        };
      }

      setImprovedData(parsedResult);
      
      toast({
        title: "✨ Prompt improved!",
        description: "Your prompt has been enhanced by the AI Coach",
      });
    } catch (error: any) {
      console.error("Agent run error:", error);
      toast({
        title: "Improvement failed",
        description: error.message || "Could not improve prompt. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApplyImprovement = () => {
    if (improvedData?.improved_prompt) {
      onPromptImproved(improvedData.improved_prompt);
      toast({
        title: "Prompt applied",
        description: "The improved prompt has been set",
      });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          AI Prompt Coach
        </CardTitle>
        <CardDescription>
          Get AI-powered suggestions to improve your image generation prompt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleImprovePrompt}
          disabled={disabled || runAgent.isPending || prompt.trim().length < 5}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {runAgent.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing prompt...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Improve My Prompt
            </>
          )}
        </Button>

        {improvedData && (
          <div className="space-y-4 pt-2">
            {/* Improved Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Improved Prompt
                </h4>
                {improvedData.confidence_score && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(improvedData.confidence_score * 100)}% confidence
                  </Badge>
                )}
              </div>
              <div className="p-3 bg-muted rounded-lg text-sm">
                {improvedData.improved_prompt}
              </div>
              <Button
                onClick={handleApplyImprovement}
                variant="default"
                size="sm"
                className="w-full"
              >
                Use This Prompt
              </Button>
            </div>

            {/* Changes Made */}
            {improvedData.changes_made && improvedData.changes_made.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Changes Made:</h4>
                <ul className="space-y-1 text-sm">
                  {improvedData.changes_made.map((change: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-muted-foreground">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Additional Suggestions */}
            {improvedData.suggestions && improvedData.suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Additional Tips:</h4>
                <ul className="space-y-1 text-sm">
                  {improvedData.suggestions.map((suggestion: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Lightbulb className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
