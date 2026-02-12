import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Copy,
  Check,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ChartConfig {
  type: "line" | "bar" | "pie";
  title: string;
  data: Array<{ label: string; value: number }>;
  caption: string;
}

interface ActionItem {
  action: string;
  owner: string;
  effort: "low" | "medium" | "high";
  confidence: number;
}

interface DataStrategistReport {
  charts: ChartConfig[];
  summary: string[];
  actions: ActionItem[];
  reproduce: string;
  data_warnings: string[];
  confidence: "High" | "Medium" | "Low";
}

interface AgentResultsDashboardProps {
  runId: string;
  report: DataStrategistReport;
  brandId?: string;
  onApprove?: (selectedActions: number[]) => void;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function AgentResultsDashboard({
  runId,
  report,
  brandId,
  onApprove,
}: AgentResultsDashboardProps) {
  const { toast } = useToast();
  const [selectedActions, setSelectedActions] = useState<number[]>([]);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(key);
      setTimeout(() => setCopiedItem(null), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const toggleAction = (index: number) => {
    setSelectedActions((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleApprove = () => {
    if (selectedActions.length === 0) {
      toast({ title: "Select at least one action", variant: "destructive" });
      return;
    }
    onApprove?.(selectedActions);
  };

  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "default";
      case "Medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getEffortBadgeVariant = (effort: string) => {
    switch (effort) {
      case "low":
        return "default";
      case "medium":
        return "secondary";
      default:
        return "destructive";
    }
  };

  const renderChart = (chart: ChartConfig, index: number) => {
    const data = chart.data.map((d) => ({ name: d.label, value: d.value }));

    return (
      <Card key={index} className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{chart.title}</CardTitle>
          <CardDescription>{chart.caption}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {chart.type === "bar" ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : chart.type === "pie" ? (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[0] }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Data Strategist Report</h2>
            <p className="text-sm text-muted-foreground">AI-generated insights and recommendations</p>
          </div>
        </div>
        <Badge variant={getConfidenceBadgeVariant(report.confidence)}>
          {report.confidence} Confidence
        </Badge>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Executive Summary</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(report.summary.join("\n"), "summary")}
            >
              {copiedItem === "summary" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.summary.map((bullet, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary font-medium">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Charts */}
      {report.charts && report.charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.charts.map(renderChart)}
        </div>
      )}

      {/* Action Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recommended Actions</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleApprove}>
                Approve Selected ({selectedActions.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {report.actions.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedActions.includes(i)}
                  onCheckedChange={() => toggleAction(i)}
                />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{action.action}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Owner:</span>
                    <span>{action.owner}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <Badge variant={getEffortBadgeVariant(action.effort)} className="text-xs">
                      {action.effort} effort
                    </Badge>
                    <span className="text-muted-foreground">
                      ({Math.round(action.confidence * 100)}% confidence)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Warnings */}
      {report.data_warnings && report.data_warnings.length > 0 && (
        <Collapsible open={showWarnings} onOpenChange={setShowWarnings}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <CardTitle className="text-base">
                      Data Quality Notes ({report.data_warnings.length})
                    </CardTitle>
                  </div>
                  {showWarnings ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {report.data_warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Reproduce Query */}
      {report.reproduce && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Reproduce Query</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(report.reproduce, "reproduce")}
              >
                {copiedItem === "reproduce" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="p-3 rounded bg-muted text-sm overflow-x-auto">
              <code>{report.reproduce}</code>
            </pre>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
