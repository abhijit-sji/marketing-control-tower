import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Loader2, Play, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgentResultsDashboard } from "./AgentResultsDashboard";
import { MultiSelect } from "@/components/ui/multi-select";

interface DataStrategistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  brandId?: string;
  brandName?: string;
}

export function DataStrategistDialog({ open, onOpenChange, userId, brandId, brandName }: DataStrategistDialogProps) {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState("30d");
  const [selectedBrands, setSelectedBrands] = useState<string[]>(brandId ? [brandId] : []);
  const [runResult, setRunResult] = useState<any>(null);
  
  // Lock to brand if passed
  const isBrandLocked = Boolean(brandId);

  // Fetch available brands
  const { data: brands = [] } = useQuery({
    queryKey: ["brands-for-agent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const brandOptions = brands.map((b) => ({ value: b.id, label: b.name }));

  // Convert timeframe to edge function format
  const getTimeframeValue = (tf: string) => {
    switch (tf) {
      case "7d": return "last_7_days";
      case "90d": return "last_quarter";
      case "365d": return "last_year";
      default: return "last_30_days";
    }
  };

  // Direct call to data-strategist-agent edge function
  const runAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("data-strategist-agent", {
        body: {
          timeframe: getTimeframeValue(timeframe),
          brand_ids: selectedBrands.length > 0 ? selectedBrands : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Analysis complete", description: "Review the insights below" });
      setRunResult({
        run_id: data.run_id,
        ai_summary: data.report,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to run analysis",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleRun = () => {
    runAgentMutation.mutate();
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
            <TrendingUp className="h-5 w-5 text-primary" />
            Data Strategist
          </DialogTitle>
          <DialogDescription>
            Analyze brand KPIs, analytics data, and generate actionable insights with charts.
          </DialogDescription>
        </DialogHeader>

        {runResult?.ai_summary ? (
          <AgentResultsDashboard
            runId={runResult.run_id}
            report={runResult.ai_summary}
            onApprove={(selected) => {
              toast({ title: `Approved ${selected.length} actions` });
            }}
          />
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Timeframe</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last quarter</SelectItem>
                    <SelectItem value="365d">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isBrandLocked ? (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <Label className="text-xs text-muted-foreground">Running for</Label>
                  <p className="font-semibold">{brandName}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Brands (optional)</Label>
                  <MultiSelect
                    options={brandOptions}
                    selected={selectedBrands}
                    onChange={setSelectedBrands}
                    placeholder="All brands"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to analyze all brands
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">What this agent will do:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Analyze brand KPIs and identify trends</li>
                  <li>Generate charts for key metrics</li>
                  <li>Recommend actions with effort estimates</li>
                  <li>Flag data quality issues</li>
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
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Analysis
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
