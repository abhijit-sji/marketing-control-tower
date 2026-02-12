import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  LineChart,
  Loader2,
  Network,
  Target,
  Users,
  Wand2,
} from "lucide-react";
import { HookPerformanceChart, HookPerformance } from "./HookPerformanceChart";
import { AudienceHeatmap, AudienceResonance } from "./AudienceHeatmap";
import { KPIAttributionCard, KPIAttribution } from "./KPIAttributionCard";
import { TopicClusterView, TopicCluster } from "./TopicClusterView";

interface LeaderRanking {
  name: string;
  posts_tracked: number;
  avg_engagement: number;
  best_audience?: string | null;
  improvement_tip: string;
}

interface ActionItem {
  text: string;
  owner?: string;
  effort?: "low" | "medium" | "high";
  impact?: string;
}

interface MarketingIntelligenceAnalysis {
  executive_summary: string;
  hook_analysis: HookPerformance[];
  audience_insights: AudienceResonance[];
  kpi_attribution: KPIAttribution[];
  topic_clusters: TopicCluster[];
  leader_effectiveness?: LeaderRanking[];
  action_items: ActionItem[];
  data_quality_score: number;
  confidence: "High" | "Medium" | "Low";
}

interface RawMetrics {
  posts_analyzed: number;
  analytics_rows: number;
  kpis_tracked: number;
  trends_reviewed: number;
}

interface MarketingIntelligenceResponse {
  success: boolean;
  run_id: string | null;
  analysis: MarketingIntelligenceAnalysis;
  raw_metrics: RawMetrics;
  meta: {
    generation_time_ms: number;
    tokens_used: number | null;
    timeframe: string;
  };
}

interface MarketingIntelligencePanelProps {
  brandId?: string;
  leaderId?: string;
  onClose?: () => void;
}

export function MarketingIntelligencePanel({
  brandId,
  leaderId,
}: MarketingIntelligencePanelProps) {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<"last_7_days" | "last_30_days" | "last_quarter" | "all">(
    "last_30_days"
  );
  const [analysisType, setAnalysisType] = useState<
    "full" | "hooks" | "audiences" | "attribution" | "topics"
  >("full");
  const [runResult, setRunResult] = useState<MarketingIntelligenceResponse | null>(null);

  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("marketing-intelligence-agent", {
        body: {
          brand_id: brandId || undefined,
          leader_id: leaderId || undefined,
          timeframe,
          analysis_type: analysisType,
        },
      });
      if (error) throw error;
      return data as MarketingIntelligenceResponse;
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast({
          title: "Analysis failed",
          description: "The agent reported a failure. Check logs for details.",
          variant: "destructive",
        });
        return;
      }
      setRunResult(data);
      toast({
        title: "Marketing intelligence generated",
        description: "Review the insights below.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to run Marketing Intelligence agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const analysis = runResult?.analysis;
  const rawMetrics = runResult?.raw_metrics;

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Marketing Intelligence</CardTitle>
            <CardDescription>
              Correlate content performance with KPIs across hooks, audiences, topics, and leaders.
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRunResult(null)}
            disabled={runMutation.isPending}
          >
            Reset
          </Button>
          <Button size="sm" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            {runMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Timeframe</Label>
            <Select
              value={timeframe}
              onValueChange={(v: any) => setTimeframe(v as typeof timeframe)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7_days">Last 7 days</SelectItem>
                <SelectItem value="last_30_days">Last 30 days</SelectItem>
                <SelectItem value="last_quarter">Last 90 days</SelectItem>
                <SelectItem value="all">All available</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Focus</Label>
            <Select
              value={analysisType}
              onValueChange={(v: any) => setAnalysisType(v as typeof analysisType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full analysis</SelectItem>
                <SelectItem value="hooks">Hook styles</SelectItem>
                <SelectItem value="audiences">Audiences</SelectItem>
                <SelectItem value="attribution">KPI attribution</SelectItem>
                <SelectItem value="topics">Topic clusters</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rawMetrics && (
            <div className="space-y-2">
              <Label>Data Coverage</Label>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  {rawMetrics.posts_analyzed} posts
                </Badge>
                <Badge variant="outline">
                  <LineChart className="h-3 w-3 mr-1" />
                  {rawMetrics.analytics_rows} analytics rows
                </Badge>
                <Badge variant="outline">
                  <Target className="h-3 w-3 mr-1" />
                  {rawMetrics.kpis_tracked} KPIs
                </Badge>
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {rawMetrics.trends_reviewed} trends
                </Badge>
              </div>
            </div>
          )}
        </div>

        {!analysis && (
          <Alert>
            <AlertDescription className="text-sm">
              Run the Marketing Intelligence agent to generate an executive summary, hook insights,
              audience heatmap, KPI attribution, topic clusters, and leader rankings.
            </AlertDescription>
          </Alert>
        )}

        {analysis && (
          <div className="space-y-4">
            {/* Executive summary + meta */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[11px]">
                      {analysis.confidence} confidence
                    </Badge>
                    <span>Data quality: {analysis.data_quality_score}/100</span>
                    {runResult?.meta && (
                      <span>
                        Runtime: {(runResult.meta.generation_time_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  {runResult?.meta?.timeframe && (
                    <Badge variant="outline" className="text-[11px]">
                      {runResult.meta.timeframe}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {analysis.executive_summary}
                </p>
              </CardContent>
            </Card>

            {/* Top-level charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <HookPerformanceChart data={analysis.hook_analysis || []} />
              <AudienceHeatmap data={analysis.audience_insights || []} />
            </div>

            {/* KPI attribution + topics */}
            <div className="grid gap-4 lg:grid-cols-2">
              <KPIAttributionCard data={analysis.kpi_attribution || []} />
              <TopicClusterView data={analysis.topic_clusters || []} />
            </div>

            {/* Leader effectiveness */}
            {analysis.leader_effectiveness && analysis.leader_effectiveness.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Leader Effectiveness</CardTitle>
                  <CardDescription>
                    Which leaders are driving the most engagement and where to improve
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2 space-y-2 text-sm">
                  {analysis.leader_effectiveness.map((leader) => (
                    <div
                      key={leader.name}
                      className="border rounded-lg px-3 py-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{leader.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          <span>{leader.posts_tracked} posts</span>
                          <span>Avg engagement {Math.round(leader.avg_engagement)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {leader.best_audience && (
                          <span className="mr-2">
                            Best audience: <strong>{leader.best_audience}</strong>
                          </span>
                        )}
                      </div>
                      <p className="text-xs">{leader.improvement_tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Action items */}
            {analysis.action_items && analysis.action_items.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recommended Actions</CardTitle>
                  <CardDescription>
                    Concrete next steps to align content with KPI outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <ScrollArea className="max-h-64 pr-2">
                    <ul className="space-y-2 text-sm">
                      {analysis.action_items.map((item, idx) => (
                        <li key={idx} className="border rounded-lg px-3 py-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-xs text-muted-foreground">
                              Action {idx + 1}
                            </span>
                            <div className="flex gap-2 text-[11px] text-muted-foreground">
                              {item.owner && <span>Owner: {item.owner}</span>}
                              {item.effort && <span>Effort: {item.effort}</span>}
                              {item.impact && <span>Impact: {item.impact}</span>}
                            </div>
                          </div>
                          <p className="text-sm">{item.text}</p>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

