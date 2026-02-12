import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface N8nWorkflow {
  id: string;
  workflow_name: string;
  workflow_slug: string;
  base_url: string;
  is_enabled: boolean;
  created_at: string;
}

export const N8nWorkflowConfig = () => {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    workflow_name: "",
    workflow_slug: "",
    base_url: "",
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("n8n_workflow_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error: any) {
      console.error("Failed to load workflows:", error);
      toast({
        title: "Error loading workflows",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newWorkflow.workflow_name || !newWorkflow.workflow_slug || !newWorkflow.base_url) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("n8n_workflow_configs")
        .insert({
          workflow_name: newWorkflow.workflow_name,
          workflow_slug: newWorkflow.workflow_slug,
          base_url: newWorkflow.base_url,
          is_enabled: false,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Workflow configuration saved successfully",
      });

      setNewWorkflow({ workflow_name: "", workflow_slug: "", base_url: "" });
      await loadWorkflows();
    } catch (error: any) {
      console.error("Failed to save workflow:", error);
      toast({
        title: "Error saving workflow",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("n8n_workflow_configs")
        .update({ is_enabled: !currentState })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: currentState ? "Workflow Disabled" : "Workflow Enabled",
        description: `The workflow has been ${!currentState ? "enabled" : "disabled"}`,
      });

      await loadWorkflows();
    } catch (error: any) {
      console.error("Failed to toggle workflow:", error);
      toast({
        title: "Error updating workflow",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      const { error } = await supabase
        .from("n8n_workflow_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Workflow deleted successfully",
      });

      await loadWorkflows();
    } catch (error: any) {
      console.error("Failed to delete workflow:", error);
      toast({
        title: "Error deleting workflow",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New n8n Workflow</CardTitle>
          <CardDescription>
            Configure a new n8n workflow connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="workflow_name">Workflow Name</Label>
              <Input
                id="workflow_name"
                placeholder="e.g., Analytics Sync"
                value={newWorkflow.workflow_name}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, workflow_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow_slug">Workflow Slug</Label>
              <Input
                id="workflow_slug"
                placeholder="e.g., analytics-sync"
                value={newWorkflow.workflow_slug}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, workflow_slug: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL</Label>
              <Input
                id="base_url"
                placeholder="https://your-n8n.com"
                value={newWorkflow.base_url}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, base_url: e.target.value })
                }
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Workflow
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Workflows</CardTitle>
          <CardDescription>
            Manage your n8n workflow connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No workflows configured yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.workflow_name}</TableCell>
                    <TableCell className="font-mono text-sm">{workflow.workflow_slug}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {workflow.base_url}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={workflow.is_enabled}
                          onCheckedChange={() =>
                            handleToggle(workflow.id, workflow.is_enabled)
                          }
                        />
                        <span className="text-sm">
                          {workflow.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
