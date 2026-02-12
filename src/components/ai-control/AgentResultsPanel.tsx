import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Copy,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  ListTodo,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIAgentRun {
  id: string;
  agent_id: string;
  title: string | null;
  ai_summary: unknown;
  generated_tasks: unknown;
  created_at: string;
  status: string | null;
  category: string | null;
}

interface AgentResultsPanelProps {
  run: AIAgentRun;
  agentName?: string;
}

interface FindingItem {
  type?: string;
  priority?: string;
  confidence?: number;
  description?: string;
}

interface AISummary {
  summary?: string;
  key_findings?: (string | FindingItem)[];
  recommendations?: (string | FindingItem)[];
  action_items?: (string | FindingItem)[];
  metrics?: {
    items_analyzed?: number;
    anomalies_detected?: number;
    high_priority_issues?: number;
    confidence_score?: number;
  };
}

// Helper to extract text from a finding item
const getItemText = (item: string | FindingItem): string => {
  if (typeof item === "string") return item;
  return item.description || JSON.stringify(item);
};

const getItemPriority = (item: string | FindingItem): string | undefined => {
  if (typeof item === "string") return undefined;
  return item.priority;
};

interface GeneratedTask {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
}

export const AgentResultsPanel = ({ run, agentName }: AgentResultsPanelProps) => {
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const summary = run.ai_summary as AISummary | null;
  const tasks = (run.generated_tasks as GeneratedTask[] | null) ?? [];

  const handleCopy = async (text: string, itemId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(itemId);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const getPriorityVariant = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No results available for this run.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{run.title || agentName || "Agent Run"}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(run.created_at), "PPpp")}
            </p>
          </div>
          <Badge variant={run.status === "completed" ? "default" : "secondary"}>
            {run.status || "Unknown"}
          </Badge>
        </div>

        <Separator />

        {/* Metrics */}
        {summary.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summary.metrics.items_analyzed !== undefined && (
              <Card className="p-3">
                <div className="text-2xl font-bold">{summary.metrics.items_analyzed}</div>
                <p className="text-xs text-muted-foreground">Items Analyzed</p>
              </Card>
            )}
            {summary.metrics.anomalies_detected !== undefined && (
              <Card className="p-3">
                <div className="text-2xl font-bold text-yellow-600">{summary.metrics.anomalies_detected}</div>
                <p className="text-xs text-muted-foreground">Anomalies</p>
              </Card>
            )}
            {summary.metrics.high_priority_issues !== undefined && (
              <Card className="p-3">
                <div className="text-2xl font-bold text-destructive">{summary.metrics.high_priority_issues}</div>
                <p className="text-xs text-muted-foreground">High Priority</p>
              </Card>
            )}
            {summary.metrics.confidence_score !== undefined && (
              <Card className="p-3">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(summary.metrics.confidence_score * 100)}%
                </div>
                <p className="text-xs text-muted-foreground">Confidence</p>
              </Card>
            )}
          </div>
        )}

        {/* Summary */}
        {summary.summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative group">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary.summary}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(summary.summary!, "summary")}
                >
                  {copiedItem === "summary" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Findings */}
        {summary.key_findings && summary.key_findings.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Key Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.key_findings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-semibold">{index + 1}.</span>
                    <span className="text-muted-foreground">{getItemText(finding)}</span>
                    {getItemPriority(finding) && (
                      <Badge variant={getPriorityVariant(getItemPriority(finding))} className="capitalize shrink-0">
                        {getItemPriority(finding)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{getItemText(rec)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Generated Tasks */}
        {tasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                Generated Tasks ({tasks.length})
              </CardTitle>
              <CardDescription>Tasks created from this analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {tasks.map((task, index) => (
                  <li key={index} className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                    </div>
                    {task.priority && (
                      <Badge variant={getPriorityVariant(task.priority)} className="capitalize shrink-0">
                        {task.priority}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Action Items (legacy format) */}
        {summary.action_items && summary.action_items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.action_items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{getItemText(item)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
};

export default AgentResultsPanel;
