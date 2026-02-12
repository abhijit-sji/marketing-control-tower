import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, TrendingUp, X, RotateCcw, Save, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgentResultsDashboard } from "./AgentResultsDashboard";
import { MultiSelect } from "@/components/ui/multi-select";
import { formatDistanceToNow } from "date-fns";

interface DataStrategistInlinePanelProps {
  brandId?: string;
  brandName?: string;
  onClose: () => void;
}

export function DataStrategistInlinePanel({ brandId: propBrandId, brandName: propBrandName, onClose }: DataStrategistInlinePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBrandId, setSelectedBrandId] = useState<string>(propBrandId || "");
  const [timeframe, setTimeframe] = useState("30d");
  const [selectedBrands, setSelectedBrands] = useState<string[]>(propBrandId ? [propBrandId] : []);
  const [runResult, setRunResult] = useState<any>(null);
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [saved, setSaved] = useState(false);

  // Use selected brand or prop brand
  const brandId = selectedBrandId || propBrandId;
  const brandName = propBrandName || "";

  // Check for recent runs for THIS brand
  const { data: recentRun } = useQuery({
    queryKey: ["recent-agent-run", brandId, "data-strategist"],
    queryFn: async () => {
      const { data: agent } = await supabase
        .from("ai_agents")
        .select("id")
        .eq("slug", "data-strategist")
        .single();

      if (!agent) return null;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("ai_agent_runs")
        .select("id, created_at, execution_context")
        .eq("agent_id", agent.id)
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(10);

      // Filter to runs that include this brand
      const relevantRun = (data || []).find((run: any) => {
        const ctx = run.execution_context;
        if (!ctx) return false;
        return ctx.brand_id === brandId || 
               (Array.isArray(ctx.brand_ids) && ctx.brand_ids.includes(brandId));
      });
      return relevantRun || null;
    },
  });

  // Fetch available brands
  const { data: brands = [], isLoading: isLoadingBrands } = useQuery({
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

  // Get selected brand name
  const selectedBrand = brands.find(b => b.id === brandId);

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
    mutationFn: async (refinement?: string) => {
      const { data, error } = await supabase.functions.invoke("data-strategist-agent", {
        body: {
          timeframe: getTimeframeValue(timeframe),
          brand_ids: selectedBrands.length > 0 ? selectedBrands : undefined,
          refinement_prompt: refinement || undefined,
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
      setShowRefinement(false);
      setRefinementPrompt("");
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
    runAgentMutation.mutate(undefined);
  };

  const handleRunWithRefinement = () => {
    runAgentMutation.mutate(refinementPrompt);
  };

  const handleRerun = () => {
    setRunResult(null);
    setShowRefinement(false);
    setRefinementPrompt("");
  };

  const handleSave = async () => {
    if (!runResult?.run_id || saved) return;
    
    try {
      // Update the run with brand association
      const { error } = await supabase
        .from("ai_agent_runs")
        .update({
          execution_context: {
            brand_id: brandId,
            brand_ids: selectedBrands,
            brand_name: brandName,
            saved_at: new Date().toISOString(),
            saved_by_user: true,
          },
        })
        .eq("id", runResult.run_id);

      if (error) throw error;
      
      // Invalidate insights query so new data appears in Insights tab
      queryClient.invalidateQueries({ queryKey: ["brand-insights", brandId] });
      
      toast({ title: "Results saved", description: "View this analysis in the Insights tab" });
      setSaved(true);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Data Strategist</CardTitle>
              <CardDescription>
                Analyze KPIs and generate insights for {brandName}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Brand Selector - show if no brandId provided (admin context) */}
        {!propBrandId && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <Label className="text-base font-semibold mb-3 block">Select Brand</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which brand you want to analyze
            </p>
            {isLoadingBrands ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading brands...</span>
              </div>
            ) : (
              <Select value={selectedBrandId} onValueChange={(value) => {
                setSelectedBrandId(value);
                setSelectedBrands([value]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Show selected brand name */}
        {propBrandId && brandName && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Analyzing:</span>{" "}
              <strong className="text-foreground">{brandName}</strong>
            </p>
          </div>
        )}
        
        {selectedBrandId && selectedBrand && !propBrandId && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Analyzing:</span>{" "}
              <strong className="text-foreground">{selectedBrand.name}</strong>
            </p>
          </div>
        )}

        {runResult?.ai_summary ? (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex gap-2">
                {showRefinement ? (
                  <div className="flex-1 space-y-2 min-w-[300px]">
                    <Textarea
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      placeholder="e.g., Focus more on conversion rates, include competitor analysis..."
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowRefinement(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleRunWithRefinement} disabled={runAgentMutation.isPending}>
                        {runAgentMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Run with Updates
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowRefinement(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Run Again
                    </Button>
                    {saved ? (
                      <Button variant="outline" size="sm" disabled className="text-green-600">
                        <Check className="mr-2 h-4 w-4" />
                        Saved
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Results
                      </Button>
                    )}
                  </>
                )}
              </div>
              {!showRefinement && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>

            <AgentResultsDashboard
              runId={runResult.run_id}
              report={runResult.ai_summary}
              brandId={brandId}
              onApprove={(selected) => {
                toast({ title: `Approved ${selected.length} actions` });
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recent run warning */}
            {recentRun && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  This agent was run {formatDistanceToNow(new Date(recentRun.created_at))} ago.
                  Running again may produce similar results.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
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

              <div className="space-y-2">
                <Label>Additional Brands (optional)</Label>
                <MultiSelect
                  options={brandOptions}
                  selected={selectedBrands}
                  onChange={setSelectedBrands}
                  placeholder="Select brands"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium mb-1">What this agent will do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Analyze brand KPIs and identify trends</li>
                <li>Generate charts for key metrics</li>
                <li>Recommend actions with effort estimates</li>
                <li>Flag data quality issues</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleRun} disabled={runAgentMutation.isPending || !brandId}>
                {runAgentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {!brandId ? "Select a brand first" : "Run Analysis"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
