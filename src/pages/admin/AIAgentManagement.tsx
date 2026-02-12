import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AgentConfigModal, AgentProviderConfig, ProviderName } from "@/features/ai/agents/AgentConfigModal";
import { CheckCircle2, Pencil, Sparkles } from "lucide-react";

interface AgentRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_enabled: boolean | null;
  scope: string | null;
}

const providerLabels: Record<ProviderName, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
};

const scopeOptions = [
  { value: "brand", label: "Brand", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  { value: "project", label: "Project", color: "bg-green-500/10 text-green-700 border-green-500/20" },
  { value: "operations", label: "Operations", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  { value: "global", label: "Global", color: "bg-muted text-muted-foreground border-border" },
];

const getScopeColor = (scope: string | null) => {
  const option = scopeOptions.find(o => o.value === scope);
  return option?.color ?? "bg-muted text-muted-foreground border-border";
};

const summarizeExternalSources = (config: AgentProviderConfig | Partial<AgentProviderConfig> | null | undefined) => {
  const entries: string[] = [];
  const sources = config?.external_data_sources;
  if (!sources || typeof sources !== "object") return entries;

  for (const [key, value] of Object.entries(sources)) {
    if (!value || typeof value !== "object") continue;
    const enabled = (value as { enabled?: boolean }).enabled;
    if (!enabled) continue;
    const version = (value as { version?: string }).version;
    entries.push(`${key}${version ? ` v${version}` : ""}`);
  }

  return entries;
};

export default function AIAgentManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["admin-ai-agents"],
    queryFn: async (): Promise<AgentRow[]> => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, slug, description, category, is_enabled, scope")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data as AgentRow[]) ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, schedule_config }: { id: string; schedule_config: any }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ schedule_config: schedule_config as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-agents"] });
      toast({ title: "Agent updated", description: "Provider configuration saved." });
      setModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to save configuration.",
        variant: "destructive",
      });
    },
  });

  const updateScopeMutation = useMutation({
    mutationFn: async ({ id, scope }: { id: string; scope: string }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ scope })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-agents"] });
      toast({ title: "Scope updated" });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update scope.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (agent: AgentRow) => {
    setSelectedAgent(agent);
    setModalOpen(true);
  };

  const handleScopeChange = (agentId: string, newScope: string) => {
    updateScopeMutation.mutate({ id: agentId, scope: newScope });
  };

  const handleSave = async (config: AgentProviderConfig) => {
    if (!selectedAgent) return;
    // Note: Config column doesn't exist in DB schema - this functionality is disabled
    toast({ 
      title: "Configuration unavailable", 
      description: "Agent configuration feature is not available in current schema.",
      variant: "destructive" 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            SEO & AI Agents
          </h1>
          <p className="text-muted-foreground">
            Configure model providers, versions, and enrichment sources per AI agent.
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" />
          Admin access
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Catalog</CardTitle>
          <p className="text-sm text-muted-foreground">
            Provider settings will cascade to the public SEO portal and internal workspaces.
          </p>
        </CardHeader>
        <CardContent>
          {agentsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-16 w-full" />
              ))}
            </div>
          ) : agentsQuery.isError ? (
            <p className="text-sm text-destructive">Unable to load agents.</p>
          ) : agentsQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI agents found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="hidden md:table-cell">Version</TableHead>
                  <TableHead className="hidden lg:table-cell">External Sources</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsQuery.data.map((agent) => {
                  // Config column doesn't exist in database - using defaults
                  const provider = "openai" as ProviderName;
                  const version = "gpt-4o-mini";

                  return (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{agent.name}</span>
                            {!agent.is_enabled && (
                              <Badge variant="outline" className="text-[11px] uppercase">Disabled</Badge>
                            )}
                          </div>
                          {agent.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{agent.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="secondary" className="capitalize">
                          {agent.category.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={agent.scope || "global"} 
                          onValueChange={(value) => handleScopeChange(agent.id, value)}
                          disabled={updateScopeMutation.isPending}
                        >
                          <SelectTrigger className={`w-[120px] h-8 text-xs border ${getScopeColor(agent.scope)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {scopeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span>{providerLabels[provider]}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{version}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">—</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(agent)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AgentConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        agent={selectedAgent}
        saving={updateMutation.isPending}
        onSave={handleSave}
      />
    </div>
  );
}
