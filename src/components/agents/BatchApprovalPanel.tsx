import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  XCircle,
  Edit,
  Loader2,
  AlertCircle,
  Send,
} from "lucide-react";
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
} from "@/components/ui/alert-dialog";

interface GeneratedTask {
  type: string;
  description: string;
  priority: string;
  assignee?: string;
  confidence?: number;
  channel?: string;
  scheduled_date?: string;
  task_reference?: string;
}

interface AgentRun {
  id: string;
  title: string;
  category: string;
  approval_status: string;
  generated_tasks: GeneratedTask[];
  ai_summary: any;
  created_at: string;
}

interface BatchApprovalPanelProps {
  runs: AgentRun[];
  onApprovalComplete?: () => void;
}

export function BatchApprovalPanel({ runs, onApprovalComplete }: BatchApprovalPanelProps) {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<{ runId: string; taskIndex: number }[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    runId: string;
    taskIndex: number;
    task: GeneratedTask;
  } | null>(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<"approve" | "reject" | null>(null);
  const [sendEmailAfterApproval, setSendEmailAfterApproval] = useState(false);

  const pendingRuns = runs.filter((r) => r.approval_status === "pending");

  const toggleItem = (runId: string, taskIndex: number) => {
    setSelectedItems((prev) => {
      const exists = prev.find((s) => s.runId === runId && s.taskIndex === taskIndex);
      if (exists) {
        return prev.filter((s) => !(s.runId === runId && s.taskIndex === taskIndex));
      }
      return [...prev, { runId, taskIndex }];
    });
  };

  const isItemSelected = (runId: string, taskIndex: number) =>
    selectedItems.some((s) => s.runId === runId && s.taskIndex === taskIndex);

  const selectAll = () => {
    const allItems = pendingRuns.flatMap((run) =>
      (run.generated_tasks || []).map((_, i) => ({ runId: run.id, taskIndex: i }))
    );
    setSelectedItems(allItems);
  };

  const deselectAll = () => {
    setSelectedItems([]);
  };

  const handleApprove = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "Select at least one item", variant: "destructive" });
      return;
    }

    setIsApproving(true);
    try {
      // Group by run
      const runGroups = selectedItems.reduce<Record<string, number[]>>((acc, item) => {
        if (!acc[item.runId]) acc[item.runId] = [];
        acc[item.runId].push(item.taskIndex);
        return acc;
      }, {});

      // Update each run
      for (const [runId, taskIndices] of Object.entries(runGroups)) {
        const { error } = await supabase
          .from("ai_agent_runs")
          .update({
            approval_status: "approved",
            approved_at: new Date().toISOString(),
          })
          .eq("id", runId);

        if (error) throw error;

        // Send digest email if requested
        if (sendEmailAfterApproval) {
          const run = runs.find((r) => r.id === runId);
          if (run) {
            const digestType =
              run.category === "operations"
                ? "chief_of_staff"
                : run.category === "business_analysis"
                  ? "data_strategist"
                  : "content_strategist";

            await supabase.functions.invoke("send-agent-digest", {
              body: { run_id: runId, digest_type: digestType },
            });
          }
        }
      }

      toast({
        title: "Items approved",
        description: `${selectedItems.length} items approved successfully`,
      });

      setSelectedItems([]);
      setConfirmDialog(null);
      onApprovalComplete?.();
    } catch (err: any) {
      toast({
        title: "Approval failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "Select at least one item", variant: "destructive" });
      return;
    }

    setIsRejecting(true);
    try {
      // Group by run
      const runIds = [...new Set(selectedItems.map((s) => s.runId))];

      for (const runId of runIds) {
        const { error } = await supabase
          .from("ai_agent_runs")
          .update({ approval_status: "rejected" })
          .eq("id", runId);

        if (error) throw error;
      }

      toast({
        title: "Items rejected",
        description: `${selectedItems.length} items rejected`,
      });

      setSelectedItems([]);
      setConfirmDialog(null);
      onApprovalComplete?.();
    } catch (err: any) {
      toast({
        title: "Rejection failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editDialog) return;

    try {
      const run = runs.find((r) => r.id === editDialog.runId);
      if (!run) return;

      const updatedTasks = [...(run.generated_tasks || [])];
      updatedTasks[editDialog.taskIndex] = {
        ...updatedTasks[editDialog.taskIndex],
        description: editedDescription,
      };

      const { error } = await supabase
        .from("ai_agent_runs")
        .update({ generated_tasks: JSON.parse(JSON.stringify(updatedTasks)) })
        .eq("id", editDialog.runId);

      if (error) throw error;

      toast({ title: "Task updated" });
      setEditDialog(null);
      onApprovalComplete?.();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (pendingRuns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No pending items for approval.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Batch Approval</h2>
          <p className="text-sm text-muted-foreground">
            {pendingRuns.length} runs pending approval
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Deselect All
          </Button>
        </div>
      </div>

      {/* Runs */}
      {pendingRuns.map((run) => (
        <Card key={run.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{run.title}</CardTitle>
                <CardDescription>
                  {run.category} • {new Date(run.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
              {getStatusBadge(run.approval_status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(run.generated_tasks || []).map((task, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={isItemSelected(run.id, i)}
                    onCheckedChange={() => toggleItem(run.id, i)}
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{task.description}</p>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(task.priority)}
                      {task.assignee && (
                        <span className="text-xs text-muted-foreground">
                          → {task.assignee}
                        </span>
                      )}
                      {task.confidence && (
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(task.confidence * 100)}% confidence)
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditDialog({ runId: run.id, taskIndex: i, task });
                      setEditedDescription(task.description);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Action Bar */}
      <div className="sticky bottom-4 flex items-center justify-between p-4 rounded-lg border bg-background shadow-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={sendEmailAfterApproval}
            onCheckedChange={(checked) => setSendEmailAfterApproval(checked === true)}
          />
          <span className="text-sm">Send digest email after approval</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmDialog("reject")}
            disabled={selectedItems.length === 0 || isRejecting}
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Reject ({selectedItems.length})
          </Button>
          <Button
            onClick={() => setConfirmDialog("approve")}
            disabled={selectedItems.length === 0 || isApproving}
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Approve ({selectedItems.length})
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Action Item</DialogTitle>
            <DialogDescription>
              Modify the description before approving.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog === "approve" ? "Approve Items?" : "Reject Items?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog === "approve" ? (
                <>
                  You are about to approve {selectedItems.length} items.
                  {sendEmailAfterApproval && " A digest email will be sent after approval."}
                </>
              ) : (
                `You are about to reject ${selectedItems.length} items. This action cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog === "approve" ? handleApprove : handleReject}
              className={confirmDialog === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {confirmDialog === "approve" ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
