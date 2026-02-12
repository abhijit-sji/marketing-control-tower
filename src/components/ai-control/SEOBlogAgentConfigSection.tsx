import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentKnowledgeSelector } from "./AgentKnowledgeSelector";

interface SEOBlogAgentConfigSectionProps {
  agentId: string;
  onClose?: () => void;
}

interface AgentConfig {
  ai_model: string;
  default_tone: string;
  default_audience: string;
  knowledge_collections: string[];
}

export function SEOBlogAgentConfigSection({ agentId, onClose }: SEOBlogAgentConfigSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch agent configuration
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['ai-agent', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const config = (agent?.data_sources as unknown as AgentConfig) || {
    ai_model: 'gpt-4o',
    default_tone: 'informative',
    default_audience: 'business professionals',
    knowledge_collections: ['brand_knowledge', 'global_knowledge']
  };

  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '');
  const [aiModel, setAiModel] = useState(config.ai_model);
  const [defaultTone, setDefaultTone] = useState(config.default_tone);
  const [defaultAudience, setDefaultAudience] = useState(config.default_audience);
  const [knowledgeCollections, setKnowledgeCollections] = useState<string[]>(
    config.knowledge_collections || []
  );

  // Update agent configuration
  const updateAgentMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('ai_agents')
        .update(updates)
        .eq('id', agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Configuration saved',
        description: 'SEO Blog Generator settings have been updated.'
      });
      queryClient.invalidateQueries({ queryKey: ['ai-agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['ai-control', 'agents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save configuration',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSaveConfiguration = () => {
    const updatedConfig: AgentConfig = {
      ai_model: aiModel,
      default_tone: defaultTone,
      default_audience: defaultAudience,
      knowledge_collections: knowledgeCollections
    };

    updateAgentMutation.mutate({
      system_prompt: systemPrompt,
      data_sources: updatedConfig,
      updated_at: new Date().toISOString()
    });
  };

  if (agentLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Configuration</CardTitle>
          <CardDescription>
            Select the AI model used for generating SEO blog content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-model">AI Model</Label>
            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger id="ai-model">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              GPT-4o is recommended for optimal SEO blog generation quality
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            The core instructions that guide the AI's blog generation behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system-prompt">System Prompt</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={20}
              className="font-mono text-xs"
              placeholder="Enter system prompt..."
            />
            <p className="text-xs text-muted-foreground">
              This prompt defines the strict SEO rules, formatting requirements, and keyword placement logic
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Base Access */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Access</CardTitle>
          <CardDescription>
            Select which knowledge sources the agent can access for context
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentKnowledgeSelector
            agentId={agentId}
          />
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Default Content Settings</CardTitle>
          <CardDescription>
            Default tone and audience settings that users can override
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-tone">Default Tone</Label>
              <Select value={defaultTone} onValueChange={setDefaultTone}>
                <SelectTrigger id="default-tone">
                  <SelectValue placeholder="Select default tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-audience">Default Target Audience</Label>
              <Input
                id="default-audience"
                value={defaultAudience}
                onChange={(e) => setDefaultAudience(e.target.value)}
                placeholder="e.g., business professionals, marketers"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These are suggested defaults - users can customize them when generating each blog
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSaveConfiguration}
          disabled={updateAgentMutation.isPending}
        >
          {updateAgentMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
