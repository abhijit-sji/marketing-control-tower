import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Play, CheckCircle, Lightbulb, Target, BarChart3 } from "lucide-react";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { useToast } from "@/hooks/use-toast";

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', provider: 'openai' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'claude' },
  { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'claude' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

interface RunAgentDialogProps {
  agent: {
    id: string;
    name: string;
    description?: string | null;
    slug?: string;
    config?: {
      model_provider?: string;
      model_version?: string;
    } | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const getDefaultModel = (agent: RunAgentDialogProps['agent']) => {
  if (agent?.config?.model_version) return agent.config.model_version;
  if (agent?.config?.model_provider === 'claude') return 'claude-3-5-sonnet-20241022';
  if (agent?.config?.model_provider === 'gemini') return 'gemini-2.5-flash';
  return 'gpt-4o-mini';
};

// Define predefined prompts for different agent types
const getAgentPrompts = (slug?: string): { label: string; prompt: string }[] => {
  const defaultPrompts = [
    { label: 'Quick Analysis', prompt: 'Provide a quick analysis with key insights and recommendations.' },
    { label: 'Detailed Report', prompt: 'Generate a detailed report covering all aspects with actionable items.' },
    { label: 'Summary', prompt: 'Give me a concise summary of the most important findings.' },
  ];

  const agentPrompts: Record<string, { label: string; prompt: string }[]> = {
    'data-strategist': [
      { label: 'Data Audit', prompt: 'Perform a comprehensive data quality and completeness audit.' },
      { label: 'Trend Analysis', prompt: 'Identify key trends and patterns in our data.' },
      { label: 'KPI Review', prompt: 'Review our KPIs and suggest improvements.' },
    ],
    'content-strategist': [
      { label: 'Content Audit', prompt: 'Audit our content strategy and identify gaps.' },
      { label: 'Topic Ideas', prompt: 'Generate content topic ideas based on our brand and audience.' },
      { label: 'Content Calendar', prompt: 'Suggest a content calendar for the next month.' },
    ],
    'chief-of-staff': [
      { label: 'Weekly Summary', prompt: 'Generate a weekly summary of team activities and priorities.' },
      { label: 'Resource Allocation', prompt: 'Analyze resource allocation and suggest optimizations.' },
      { label: 'Priority Review', prompt: 'Review current priorities and flag any concerns.' },
    ],
  };

  return agentPrompts[slug || ''] || defaultPrompts;
};

interface AIAnalysisResponse {
  summary?: string;
  keyFindings?: string[];
  key_findings?: string[];
  recommendations?: string[];
  actionItems?: { title: string; priority: string; description: string }[];
  action_items?: { type: string; description: string; priority: string }[];
  metrics?: { name: string; value: string | number; change?: string }[];
}

export const RunAgentDialog = ({ agent, open, onOpenChange, userId }: RunAgentDialogProps) => {
  const { toast } = useToast();
  const runAgentMutation = useRunAIAgent();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AIAnalysisResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => getDefaultModel(agent));

  const predefinedPrompts = getAgentPrompts(agent?.slug);

  const handleRunAgent = async (customPrompt?: string) => {
    if (!agent) return;

    const finalPrompt = customPrompt || prompt;

    if (!finalPrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please select an option or provide instructions for the agent.",
        variant: "destructive",
      });
      return;
    }

    setResult(null);

    runAgentMutation.mutate(
      {
        agent_id: agent.id,
        execution_context: {
          user_id: userId,
          prompt: finalPrompt.trim(),
          context: "User agent run",
          model: selectedModel,
        },
      },
      {
        onSuccess: (data) => {
          const analysisResult = data?.ai_summary || data?.result || data;
          setResult(analysisResult as AIAnalysisResponse);
        },
        onError: (error) => {
          toast({
            title: "Failed to run agent",
            description: error instanceof Error ? error.message : "An unknown error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt);
    handleRunAgent(quickPrompt);
  };

  const handleClose = () => {
    if (!runAgentMutation.isPending) {
      setPrompt("");
      setResult(null);
      setSelectedModel(getDefaultModel(agent));
      onOpenChange(false);
    }
  };

  const keyFindings = result?.keyFindings || result?.key_findings || [];
  const actionItems = result?.actionItems || (result?.action_items || []).map(item => ({
    title: item.description,
    priority: item.priority,
    description: item.description
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run {agent?.name}
          </DialogTitle>
          <DialogDescription>
            {agent?.description || "Select an option or provide custom instructions for the agent."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Predefined Prompts */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Quick Options</p>
            <div className="flex flex-wrap gap-2">
              {predefinedPrompts.map((item, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt(item.prompt)}
                  disabled={runAgentMutation.isPending}
                  className="text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">AI Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={runAgentMutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              Or write custom instructions
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your instructions or question for the agent..."
              className="min-h-[100px]"
              disabled={runAgentMutation.isPending}
            />
          </div>

          {/* Run Button */}
          <Button
            onClick={() => handleRunAgent()}
            disabled={runAgentMutation.isPending || !prompt.trim()}
            className="w-full"
          >
            {runAgentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Agent
              </>
            )}
          </Button>

          {/* Loading State */}
          {runAgentMutation.isPending && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Processing your request...</p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && !runAgentMutation.isPending && (
            <div className="space-y-3 pt-2">
              {/* Summary */}
              {result.summary && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-sm text-muted-foreground">{result.summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Key Findings */}
              {keyFindings.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Key Findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <ul className="space-y-1">
                      {keyFindings.slice(0, 5).map((finding, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                          <span className="text-muted-foreground">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <ul className="space-y-1">
                      {result.recommendations.slice(0, 5).map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Lightbulb className="h-3 w-3 text-amber-500 mt-1 shrink-0" />
                          <span className="text-muted-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Action Items */}
              {actionItems.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-purple-500" />
                      Action Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-2">
                      {actionItems.slice(0, 3).map((item, i) => (
                        <div key={i} className="p-2 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{item.title}</span>
                            <Badge 
                              variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {item.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
