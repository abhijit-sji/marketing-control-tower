import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, Database, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeRecord {
  id: string;
  title: string;
  category: string | null;
  tags?: string[] | null;
  content: string | null;
  is_active?: boolean | null;
  updated_at?: string | null;
}

interface VectorStoreRecord {
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface AIKnowledgeSectionProps {
  canManageSync: boolean;
  onSyncComplete?: (timestamp: string) => void;
}

export const AIKnowledgeSection = ({ canManageSync, onSyncComplete }: AIKnowledgeSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const knowledgeQuery = useQuery({
    queryKey: ["knowledge-base", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("id, title, knowledge_type, keywords, content, is_active, updated_at")
        .eq("is_active", true)
        .order("knowledge_type")
        .order("title");

      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title as string,
        category: (row as { knowledge_type?: string }).knowledge_type ?? null,
        tags: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
        content: row.content as string | null,
        is_active: row.is_active,
        updated_at: row.updated_at,
      })) as KnowledgeRecord[];
    },
  });

  const vectorStoreQuery = useQuery({
    queryKey: ["knowledge-base", "vector-store"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_shared_resources")
        .select("metadata, updated_at")
        .eq("resource_type", "vector_store")
        .eq("resource_name", "company_knowledge")
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as VectorStoreRecord | null;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("knowledge-base", {
        method: "POST",
        body: { action: "sync-to-chroma" },
      });

      if (error) throw error;
      return data as { success?: boolean; synced?: number; timestamp?: string };
    },
    onSuccess: (data) => {
      const syncedCount = data?.synced ?? 0;
      toast({
        title: "Knowledge sync started",
        description: syncedCount
          ? `Queued ${syncedCount} knowledge item${syncedCount === 1 ? "" : "s"} for embedding.`
          : "Knowledge sync request sent.",
      });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", "vector-store"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", "active"] });
      if (onSyncComplete && data?.timestamp) {
        onSyncComplete(data.timestamp);
      }
    },
    onError: (error: unknown) => {
      toast({
        title: "Knowledge sync failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const groupedKnowledge = useMemo(() => {
    const data = knowledgeQuery.data ?? [];
    return data.reduce<Record<string, KnowledgeRecord[]>>((acc, record) => {
      const key = record.category ?? "general";
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    }, {});
  }, [knowledgeQuery.data]);

  const lastUpdated = vectorStoreQuery.data?.updated_at ?? null;
  const metadata = vectorStoreQuery.data?.metadata as { file_count?: number } | null | undefined;
  const documentCount = Number(metadata?.file_count ?? 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Knowledge Sync</CardTitle>
            <CardDescription>
              Ensure company knowledge is indexed for all AI agents. The sync runs automatically every 24 hours.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border px-3 py-2 text-left text-sm">
              <p className="text-xs text-muted-foreground">Last synced</p>
              <p className="font-medium">
                {lastUpdated ? new Date(lastUpdated).toLocaleString() : "No sync history"}
              </p>
            </div>
            <Button onClick={() => syncMutation.mutate()} disabled={!canManageSync || syncMutation.isPending}>
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Sync Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Database className="h-10 w-10 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Documents in sync</p>
                <p className="text-2xl font-semibold">{documentCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border p-4 md:col-span-2">
            <Alert className="border-none bg-muted/40">
              <Info className="h-4 w-4" />
              <AlertTitle>Knowledge health</AlertTitle>
              <AlertDescription>
                Syncing refreshes embeddings, ensuring agents use the latest company insights and tone guidelines.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {Object.entries(groupedKnowledge).map(([category, records]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="capitalize">{category.replace(/_/g, " ")}</span>
                <Badge variant="outline">{records.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{record.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {record.updated_at ? new Date(record.updated_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {record.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {record.content && (
                    <>
                      <Separator className="my-3" />
                      <p className="text-sm text-muted-foreground line-clamp-3">{record.content}</p>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {knowledgeQuery.data?.length === 0 && !knowledgeQuery.isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No active knowledge items found. Add entries in the Company Knowledge manager to power contextual responses.
            </CardContent>
          </Card>
        )}

        {knowledgeQuery.isLoading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AIKnowledgeSection;
