import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, BrainCircuit, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIMemorySectionProps {
  canManage: boolean;
}

interface MemoryEntry {
  id: string;
  content: string;
  created_at: string;
  tags?: string[];
  score?: number;
}

interface MemoryResponse {
  entries: MemoryEntry[];
  total: number;
  status: string;
  message?: string;
}

interface AgentSummary {
  id: string;
  name: string;
  category: string;
}

export const AIMemorySection = ({ canManage }: AIMemorySectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["ai-control", "agents", "memory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, category")
        .eq("is_enabled", true)
        .order("name");

      if (error) throw error;
      return (data ?? []) as AgentSummary[];
    },
  });

  const memoryQuery = useQuery({
    queryKey: ["ai-control", "memory", selectedAgent],
    enabled: Boolean(selectedAgent),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("mem0-agent-memory", {
        method: "POST",
        body: { action: "list", agentId: selectedAgent },
      });

      if (error) throw error;
      return (data ?? { entries: [], total: 0, status: "disconnected" }) as MemoryResponse;
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("mem0-agent-memory", {
        method: "POST",
        body: { action: "clear", agentId: selectedAgent },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Memory cleared", description: "Mem0 history removed for this agent." });
      queryClient.invalidateQueries({ queryKey: ["ai-control", "memory", selectedAgent] });
    },
    onError: (error) => {
      toast({
        title: "Failed to clear memory",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("mem0-agent-memory", {
        method: "POST",
        body: { action: "rebuild", agentId: selectedAgent },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Memory rebuild queued", description: "Mem0 will regenerate tone and context for this agent." });
      queryClient.invalidateQueries({ queryKey: ["ai-control", "memory", selectedAgent] });
    },
    onError: (error) => {
      toast({
        title: "Failed to rebuild memory",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const entries = memoryQuery.data?.entries ?? [];
  const totalMemories = memoryQuery.data?.total ?? 0;
  const mem0Status = memoryQuery.data?.status ?? "unknown";
  const statusMessage = memoryQuery.data?.message;

  const selectedAgentDetails = useMemo(
    () => agentsQuery.data?.find((agent) => agent.id === selectedAgent) ?? null,
    [agentsQuery.data, selectedAgent]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Mem0 Session Memory</CardTitle>
            <CardDescription>
              Inspect and curate personalized memories per agent. Clearing resets tone and persona instructions.
            </CardDescription>
          </div>
          <Select
            value={selectedAgent ?? undefined}
            onValueChange={(value) => setSelectedAgent(value)}
            disabled={agentsQuery.isLoading || !agentsQuery.data?.length}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agentsQuery.data?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        {selectedAgent ? (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="capitalize">
                {selectedAgentDetails?.category || "agent"}
              </Badge>
              <Badge variant={mem0Status === "connected" ? "default" : "outline"}>
                Status: {mem0Status}
              </Badge>
              <Badge variant="outline">Memories: {totalMemories}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => rebuildMutation.mutate()}
                disabled={!canManage || rebuildMutation.isPending}
              >
                {rebuildMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rebuilding
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" /> Rebuild Memory
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => clearMutation.mutate()}
                disabled={!canManage || clearMutation.isPending}
              >
                {clearMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Clearing
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Memory
                  </>
                )}
              </Button>
            </div>

            <Alert className="bg-muted/40">
              <BrainCircuit className="h-4 w-4" />
              <AlertTitle>Mem0 insights</AlertTitle>
              <AlertDescription>
                Entries are automatically appended to prompts for personalization. Rebuilding pulls the latest company
                knowledge as fresh context.
              </AlertDescription>
            </Alert>

            {statusMessage && (
              <Alert variant="destructive">
                <AlertTitle>Mem0 status</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}

            {memoryQuery.isLoading ? (
              <div className="flex h-36 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length > 0 ? (
              <ScrollArea className="max-h-72 rounded-lg border border-border">
                <div className="divide-y">
                  {entries.map((entry) => (
                    <div key={entry.id} className="space-y-1 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                        {typeof entry.score === "number" && (
                          <Badge variant="outline">Score {entry.score.toFixed(2)}</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground whitespace-pre-line">{entry.content}</p>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/50 p-8 text-center text-sm text-muted-foreground">
                No memories stored yet for this agent.
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Select an agent to inspect its Mem0 context and tone history.
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AIMemorySection;
