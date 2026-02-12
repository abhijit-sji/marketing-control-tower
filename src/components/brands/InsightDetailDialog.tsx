import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AgentResultsDashboard } from "@/components/agents/AgentResultsDashboard";
import { format } from "date-fns";
import {
  Brain,
  Calendar,
  Pencil,
  Trash2,
  Database,
  Loader2,
  X,
  Save,
} from "lucide-react";

interface Insight {
  id: string;
  title: string | null;
  ai_summary: any;
  category: string | null;
  status: string | null;
  created_at: string;
}

interface InsightDetailDialogProps {
  insight: Insight | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

export function InsightDetailDialog({
  insight,
  open,
  onOpenChange,
  brandId,
  onDeleted,
  onUpdated,
}: InsightDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");

  // Check if the ai_summary is a Data Strategist report format
  const isDataStrategistReport = (summary: any): boolean => {
    if (!summary || typeof summary !== "object") return false;
    return (
      Array.isArray(summary.charts) ||
      Array.isArray(summary.actions) ||
      Array.isArray(summary.summary)
    );
  };

  // Get display summary text
  const getSummaryText = (summary: any): string => {
    if (typeof summary === "string") return summary;
    if (summary?.summary && Array.isArray(summary.summary)) {
      return summary.summary.join("\n\n");
    }
    if (summary?.summary && typeof summary.summary === "string") {
      return summary.summary;
    }
    return JSON.stringify(summary, null, 2);
  };

  // Update insight mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      title,
      ai_summary,
    }: {
      title: string;
      ai_summary: any;
    }) => {
      const { error } = await supabase
        .from("ai_agent_runs")
        .update({
          title,
          ai_summary:
            typeof insight?.ai_summary === "string"
              ? ai_summary
              : { ...insight?.ai_summary, summary: ai_summary },
        })
        .eq("id", insight!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Insight updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["brand-insights", brandId] });
      setIsEditing(false);
      onUpdated?.();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update insight",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Delete insight mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ai_agent_runs")
        .delete()
        .eq("id", insight!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Insight deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["brand-insights", brandId] });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to delete insight",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Convert to knowledge base mutation
  const convertToKBMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "convert-insight-to-knowledge",
        {
          body: {
            insight_id: insight!.id,
            brand_id: brandId,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Insight added to Knowledge Base",
        description: "The insight has been indexed and is now searchable.",
      });
      queryClient.invalidateQueries({ queryKey: ["brand-knowledge", brandId] });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to convert insight",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = () => {
    setEditTitle(insight?.title || "");
    setEditSummary(getSummaryText(insight?.ai_summary));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      title: editTitle,
      ai_summary: editSummary,
    });
  };

  if (!insight) return null;

  const showDataStrategistDashboard = isDataStrategistReport(insight.ai_summary);
  const summaryText = getSummaryText(insight.ai_summary);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold"
                    placeholder="Insight title"
                  />
                ) : (
                  <DialogTitle className="text-xl">
                    {insight.title || "Untitled Insight"}
                  </DialogTitle>
                )}
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(insight.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  {insight.category && (
                    <Badge variant="outline">{insight.category}</Badge>
                  )}
                  {insight.status && (
                    <Badge
                      variant={insight.status === "completed" ? "default" : "secondary"}
                    >
                      {insight.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        {/* Content Section */}
        <div className="space-y-4">
          {showDataStrategistDashboard && !isEditing ? (
            <AgentResultsDashboard
              runId={insight.id}
              report={insight.ai_summary}
            />
          ) : isEditing ? (
            <div className="space-y-3">
              <Label htmlFor="edit-summary">Summary</Label>
              <Textarea
                id="edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={10}
                placeholder="Edit the insight summary..."
              />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-muted-foreground">
                {summaryText}
              </p>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={updateMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2 flex-1">
                <Button variant="outline" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Insight</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this insight? This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <Button
                onClick={() => convertToKBMutation.mutate()}
                disabled={convertToKBMutation.isPending}
              >
                {convertToKBMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Add to Knowledge Base
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
