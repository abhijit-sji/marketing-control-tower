import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Database,
  Settings,
  Save,
  Loader2,
  Calendar,
  Zap,
  Table,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgentKnowledgeSelector } from "./AgentKnowledgeSelector";
import { Json } from "@/integrations/supabase/types";

interface GenericAgentConfigProps {
  agentId: string;
  onClose?: () => void;
}

interface AgentData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  system_prompt: string;
  data_sources: Json;
  schedule_config: Json;
  output_actions: Json;
  is_enabled: boolean;
}

// Data source descriptions for each table
const DATA_SOURCE_DESCRIPTIONS: Record<string, string> = {
  brands: "Brand profiles, configurations, and team settings",
  brand_kpis: "KPI metrics with current values and targets",
  brand_analytics_data: "Analytics metrics over time periods",
  projects: "Project information, budgets, and status",
  project_tasks: "Task tracking with status, due dates, and assignments",
  employees: "Team member information and reporting structure",
  team_eod_submissions: "Daily activity logs and EOD reports",
  team_daily_summaries: "Aggregated team summaries and insights",
  leader_uploads: "Transcripts, content files, and document summaries",
  thought_leaders: "Leader profiles, preferences, and style guides",
  generated_posts: "Previously generated content and posts",
  content_performance_metrics: "Content analytics and engagement data",
};

function parseScheduleConfig(config: Json): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return "No schedule configured";
  }

  const scheduleObj = config as Record<string, unknown>;
  const schedule = scheduleObj.schedule as string | undefined;
  const time = scheduleObj.time as string | undefined;
  const day = scheduleObj.day as string | undefined;
  const days = scheduleObj.days as string[] | undefined;

  if (!schedule) return "Manual trigger only";

  if (schedule === "daily" && days && time) {
    const dayNames = days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
    return `Daily at ${time} (${dayNames})`;
  }

  if (schedule === "weekly" && day && time) {
    const dayName = day.charAt(0).toUpperCase() + day.slice(1);
    return `Weekly on ${dayName} at ${time}`;
  }

  return `${schedule} schedule`;
}

function parseOutputActions(actions: Json): { key: string; enabled: boolean }[] {
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
    return [];
  }

  const actionsObj = actions as Record<string, unknown>;
  return Object.entries(actionsObj).map(([key, value]) => ({
    key: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    enabled: Boolean(value),
  }));
}

function parseDataSources(sources: Json): string[] {
  if (Array.isArray(sources)) {
    return sources.filter((s): s is string => typeof s === "string");
  }
  return [];
}

export function GenericAgentConfig({ agentId, onClose }: GenericAgentConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);

  // Fetch agent data
  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent-config", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, slug, description, category, system_prompt, data_sources, schedule_config, output_actions, is_enabled")
        .eq("id", agentId)
        .single();

      if (error) throw error;
      return data as AgentData;
    },
  });

  // Mutation to update system prompt
  const updatePromptMutation = useMutation({
    mutationFn: async (newPrompt: string) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ system_prompt: newPrompt })
        .eq("id", agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "System prompt updated",
        description: "The agent's instructions have been saved.",
      });
      setEditedPrompt(null);
      queryClient.invalidateQueries({ queryKey: ["agent-config", agentId] });
      queryClient.invalidateQueries({ queryKey: ["ai-control", "agents"] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSavePrompt = () => {
    if (editedPrompt !== null) {
      updatePromptMutation.mutate(editedPrompt);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Agent not found</AlertDescription>
      </Alert>
    );
  }

  const currentPrompt = editedPrompt ?? agent.system_prompt;
  const hasChanges = editedPrompt !== null && editedPrompt !== agent.system_prompt;
  const dataSources = parseDataSources(agent.data_sources);
  const scheduleText = parseScheduleConfig(agent.schedule_config);
  const outputActions = parseOutputActions(agent.output_actions);

  return (
    <Tabs defaultValue="prompt" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="prompt" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          System Prompt
        </TabsTrigger>
        <TabsTrigger value="knowledge" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Knowledge
        </TabsTrigger>
        <TabsTrigger value="data" className="flex items-center gap-2">
          <Table className="h-4 w-4" />
          Data Sources
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>

      {/* System Prompt Tab */}
      <TabsContent value="prompt" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Instructions</CardTitle>
            <CardDescription>
              Define how this agent behaves, what outputs it produces, and any rules it should follow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={currentPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Enter system prompt..."
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {currentPrompt.length.toLocaleString()} characters
              </p>
              <Button
                onClick={handleSavePrompt}
                disabled={!hasChanges || updatePromptMutation.isPending}
              >
                {updatePromptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Knowledge Sources Tab */}
      <TabsContent value="knowledge">
        <AgentKnowledgeSelector agentId={agentId} />
      </TabsContent>

      {/* Data Sources Tab */}
      <TabsContent value="data" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Tables
            </CardTitle>
            <CardDescription>
              The agent reads from these database tables when generating outputs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataSources.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No data sources configured for this agent.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {dataSources.map((source) => (
                  <div
                    key={source}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <Table className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm font-mono">{source}</p>
                      <p className="text-xs text-muted-foreground">
                        {DATA_SOURCE_DESCRIPTIONS[source] || "Database table"}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-4">
        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule
            </CardTitle>
            <CardDescription>When this agent runs automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {scheduleText}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Output Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Output Actions
            </CardTitle>
            <CardDescription>What this agent produces when it runs.</CardDescription>
          </CardHeader>
          <CardContent>
            {outputActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No output actions configured.</p>
            ) : (
              <div className="space-y-3">
                {outputActions.map((action) => (
                  <div key={action.key} className="flex items-center justify-between">
                    <Label className="text-sm">{action.key}</Label>
                    <Switch checked={action.enabled} disabled />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Agent Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Category</p>
                <p className="text-sm text-muted-foreground capitalize">{agent.category.replace(/_/g, " ")}</p>
              </div>
              <Badge variant={agent.is_enabled ? "default" : "secondary"}>
                {agent.is_enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            <div>
              <p className="font-medium">Slug</p>
              <p className="text-sm font-mono text-muted-foreground">{agent.slug}</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
