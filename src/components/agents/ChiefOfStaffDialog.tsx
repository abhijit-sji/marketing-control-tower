import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, Clock } from "lucide-react";
import { useRunAIAgent } from "@/hooks/useRunAIAgent";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DailyDigestPanel } from "./DailyDigestPanel";

interface ChiefOfStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function ChiefOfStaffDialog({ open, onOpenChange, userId }: ChiefOfStaffDialogProps) {
  const { toast } = useToast();
  const runAgentMutation = useRunAIAgent();
  const [scope, setScope] = useState("all");
  const [riskDays, setRiskDays] = useState([7]);
  const [includeRisks, setIncludeRisks] = useState(true);
  const [includeBlocked, setIncludeBlocked] = useState(true);
  const [includeQuickWins, setIncludeQuickWins] = useState(true);
  const [runResult, setRunResult] = useState<any>(null);

  // Fetch agent ID
  const { data: agent } = useQuery({
    queryKey: ["agent-by-slug", "chief-of-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name")
        .eq("slug", "chief-of-staff")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleRun = async () => {
    if (!agent) {
      toast({ title: "Agent not found", variant: "destructive" });
      return;
    }

    runAgentMutation.mutate(
      {
        agent_id: agent.id,
        execution_context: {
          user_id: userId,
          scope,
          risk_threshold_days: riskDays[0],
          include: {
            risks: includeRisks,
            blocked: includeBlocked,
            quick_wins: includeQuickWins,
          },
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Digest generated", description: "Processing complete" });
          setRunResult(data);
        },
        onError: (error) => {
          toast({
            title: "Failed to run agent",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleClose = () => {
    if (!runAgentMutation.isPending) {
      setRunResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Chief of Staff Daily Digest
          </DialogTitle>
          <DialogDescription>
            Generate a daily operations summary with at-risk tasks, blocked items, and quick wins.
          </DialogDescription>
        </DialogHeader>

        {runResult?.digest ? (
          <DailyDigestPanel
            runId={runResult.run_id}
            digest={runResult.digest}
            providerMeta={runResult.provider_meta}
            dataSourcesUsed={runResult.data_sources_used}
          />
        ) : (
          <>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    <SelectItem value="my_projects">My Assigned Projects</SelectItem>
                    <SelectItem value="my_tasks">My Tasks Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Risk Threshold</Label>
                  <span className="text-sm text-muted-foreground">{riskDays[0]} days</span>
                </div>
                <Slider
                  value={riskDays}
                  onValueChange={setRiskDays}
                  min={3}
                  max={14}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Tasks within {riskDays[0]} days of their due date will be flagged as at-risk
                </p>
              </div>

              <div className="space-y-3">
                <Label>Include in Digest</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-risks"
                      checked={includeRisks}
                      onCheckedChange={(checked) => setIncludeRisks(!!checked)}
                    />
                    <label htmlFor="include-risks" className="text-sm cursor-pointer">
                      At-Risk Tasks (approaching deadline)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-blocked"
                      checked={includeBlocked}
                      onCheckedChange={(checked) => setIncludeBlocked(!!checked)}
                    />
                    <label htmlFor="include-blocked" className="text-sm cursor-pointer">
                      Blocked Items (waiting on dependencies)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-quickwins"
                      checked={includeQuickWins}
                      onCheckedChange={(checked) => setIncludeQuickWins(!!checked)}
                    />
                    <label htmlFor="include-quickwins" className="text-sm cursor-pointer">
                      Quick Wins (high impact, low effort)
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">What this agent will do:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Scan project tasks for risks and blockers</li>
                  <li>Generate Slack/email templates for follow-ups</li>
                  <li>Identify quick wins to close out</li>
                  <li>Summarize daily operations status</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={runAgentMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleRun} disabled={runAgentMutation.isPending}>
                {runAgentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Digest
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
