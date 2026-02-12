import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  Zap,
  Mail,
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Users,
  FileText,
  MessageCircle,
  Sunrise,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RiskItem {
  task_id: string;
  task_name: string;
  project_name: string;
  assignee: string;
  risk_reason: string;
  next_action: string;
  priority: "high" | "medium" | "low";
}

interface BlockedItem {
  task_id: string;
  task_name: string;
  project_name: string;
  blocker_identity: string;
  unblock_ask: string;
}

interface QuickWin {
  task_id: string;
  task_name: string;
  estimated_time: string;
  impact: string;
}

interface MessageTemplate {
  task_id: string;
  recipient: string;
  message: string;
}

interface ChiefOfStaffDigest {
  digest_text: string;
  risk_list: RiskItem[];
  blocked_list: BlockedItem[];
  quick_wins: QuickWin[];
  slack_templates: MessageTemplate[];
  email_templates: MessageTemplate[];
}

interface ProviderMeta {
  provider: string;
  version: string;
  api_model: string;
  response_time_ms: number;
  total_tokens: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

interface DataSourcesUsed {
  project_tasks?: {
    queried: boolean;
    count: number;
    blocked?: number;
    at_risk?: number;
  };
  employees?: {
    queried: boolean;
    count: number;
  };
  eod_submissions?: {
    queried: boolean;
    count: number;
    with_blockers?: number;
  };
  daily_head_starts?: {
    queried: boolean;
    count: number;
  };
  task_comments?: {
    queried: boolean;
    count: number;
  };
}

interface DailyDigestPanelProps {
  runId: string;
  digest: ChiefOfStaffDigest;
  providerMeta?: ProviderMeta;
  dataSourcesUsed?: DataSourcesUsed;
  onSendDigest?: () => void;
}

export function DailyDigestPanel({ runId, digest, providerMeta, dataSourcesUsed, onSendDigest }: DailyDigestPanelProps) {
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [expandedBlocked, setExpandedBlocked] = useState<string | null>(null);
  const [templateDialog, setTemplateDialog] = useState<{
    type: "slack" | "email";
    taskId: string;
    message: string;
    recipient: string;
  } | null>(null);

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

  const handleSendDigest = async () => {
    setIsSendingDigest(true);
    try {
      const { error } = await supabase.functions.invoke("send-agent-digest", {
        body: { run_id: runId, digest_type: "chief_of_staff" },
      });
      if (error) throw error;
      toast({ title: "Digest sent successfully" });
      onSendDigest?.();
    } catch (err: any) {
      toast({ title: "Failed to send digest", description: err.message, variant: "destructive" });
    } finally {
      setIsSendingDigest(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const findSlackTemplate = (taskId: string) =>
    digest.slack_templates?.find((t) => t.task_id === taskId);

  const findEmailTemplate = (taskId: string) =>
    digest.email_templates?.find((t) => t.task_id === taskId);

  const copyFullDigest = () => {
    const lines = [
      `📊 Daily Chief of Staff Digest - ${new Date().toLocaleDateString()}`,
      '',
      digest.digest_text,
      '',
      `⚠️ At-Risk Tasks (${digest.risk_list?.length || 0}):`,
      ...(digest.risk_list || []).map(r => `  • ${r.task_name} - ${r.risk_reason}`),
      '',
      `🚫 Blocked Items (${digest.blocked_list?.length || 0}):`,
      ...(digest.blocked_list || []).map(b => `  • ${b.task_name} - ${b.blocker_identity}`),
      '',
      `⚡ Quick Wins (${digest.quick_wins?.length || 0}):`,
      ...(digest.quick_wins || []).map(q => `  • ${q.task_name} (${q.estimated_time})`),
    ];
    handleCopy(lines.join('\n'), 'full-digest');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Daily Chief of Staff Digest</h2>
            <p className="text-sm text-muted-foreground">Operations summary and action items</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyFullDigest}>
            {copiedItem === 'full-digest' ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy Digest
          </Button>
          <Button onClick={handleSendDigest} disabled={isSendingDigest}>
            {isSendingDigest ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Digest
          </Button>
        </div>
      </div>

      {/* Provider Metadata */}
      {providerMeta && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              {providerMeta.api_model}
            </Badge>
          </span>
          <span>⏱ {(providerMeta.response_time_ms / 1000).toFixed(1)}s</span>
          {providerMeta.total_tokens && (
            <span>📊 {providerMeta.total_tokens.toLocaleString()} tokens</span>
          )}
        </div>
      )}

      {/* Data Coverage Stats */}
      {dataSourcesUsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Data Analyzed
            </CardTitle>
            <CardDescription>Data sources used in this analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {dataSourcesUsed.project_tasks?.queried && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Tasks</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{dataSourcesUsed.project_tasks.count} total</span>
                    {dataSourcesUsed.project_tasks.blocked !== undefined && (
                      <span className="text-warning">
                        {dataSourcesUsed.project_tasks.blocked} blocked
                      </span>
                    )}
                    {dataSourcesUsed.project_tasks.at_risk !== undefined && (
                      <span className="text-destructive">
                        {dataSourcesUsed.project_tasks.at_risk} at-risk
                      </span>
                    )}
                  </div>
                </div>
              )}
              {dataSourcesUsed.employees?.queried && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Active Employees</span>
                  </div>
                  <span className="text-muted-foreground">{dataSourcesUsed.employees.count}</span>
                </div>
              )}
              {dataSourcesUsed.eod_submissions?.queried && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">EOD Submissions</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{dataSourcesUsed.eod_submissions.count} total</span>
                    {dataSourcesUsed.eod_submissions.with_blockers !== undefined && (
                      <span className="text-warning">
                        {dataSourcesUsed.eod_submissions.with_blockers} with blockers
                      </span>
                    )}
                  </div>
                </div>
              )}
              {dataSourcesUsed.daily_head_starts?.queried && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Sunrise className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Morning Check-ins</span>
                  </div>
                  <span className="text-muted-foreground">{dataSourcesUsed.daily_head_starts.count}</span>
                </div>
              )}
              {dataSourcesUsed.task_comments?.queried && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Task Comments</span>
                  </div>
                  <span className="text-muted-foreground">{dataSourcesUsed.task_comments.count}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview */}
      {digest.digest_text && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{digest.digest_text}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{digest.risk_list?.length || 0}</p>
                <p className="text-sm text-muted-foreground">At-Risk Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{digest.blocked_list?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Blocked Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{digest.quick_wins?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Quick Wins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk List */}
      {digest.risk_list && digest.risk_list.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              High-Risk Tasks
            </CardTitle>
            <CardDescription>Tasks requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.risk_list.map((item) => (
              <Collapsible
                key={item.task_id}
                open={expandedRisk === item.task_id}
                onOpenChange={(open) => setExpandedRisk(open ? item.task_id : null)}
              >
                <div className="border rounded-lg p-4">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-start justify-between cursor-pointer">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(item.priority)}>
                            {item.priority}
                          </Badge>
                          <span className="font-medium">{item.task_name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.project_name}</p>
                      </div>
                      {expandedRisk === item.task_id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Risk Reason</p>
                      <p className="text-sm text-muted-foreground">{item.risk_reason}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Assignee</p>
                      <p className="text-sm text-muted-foreground">{item.assignee}</p>
                    </div>
                    <div className="p-3 rounded bg-muted">
                      <p className="text-sm font-medium">Next Action</p>
                      <p className="text-sm">{item.next_action}</p>
                    </div>
                    <div className="flex gap-2">
                      {findSlackTemplate(item.task_id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const template = findSlackTemplate(item.task_id)!;
                            setTemplateDialog({
                              type: "slack",
                              taskId: item.task_id,
                              message: template.message,
                              recipient: template.recipient,
                            });
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Slack Template
                        </Button>
                      )}
                      {findEmailTemplate(item.task_id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const template = findEmailTemplate(item.task_id)!;
                            setTemplateDialog({
                              type: "email",
                              taskId: item.task_id,
                              message: template.message,
                              recipient: template.recipient,
                            });
                          }}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email Template
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Blocked Items */}
      {digest.blocked_list && digest.blocked_list.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Blocked Items
            </CardTitle>
            <CardDescription>Items waiting for unblock action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.blocked_list.map((item) => (
              <Collapsible
                key={item.task_id}
                open={expandedBlocked === item.task_id}
                onOpenChange={(open) => setExpandedBlocked(open ? item.task_id : null)}
              >
                <div className="border border-warning/30 rounded-lg p-4 bg-warning/5">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-start justify-between cursor-pointer">
                      <div className="space-y-1">
                        <span className="font-medium">{item.task_name}</span>
                        <p className="text-sm text-muted-foreground">{item.project_name}</p>
                      </div>
                      {expandedBlocked === item.task_id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Blocker</p>
                      <p className="text-sm text-muted-foreground">{item.blocker_identity}</p>
                    </div>
                    <div className="p-3 rounded bg-muted">
                      <p className="text-sm font-medium">To Unblock</p>
                      <p className="text-sm">{item.unblock_ask}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(item.unblock_ask, `unblock-${item.task_id}`)}
                    >
                      {copiedItem === `unblock-${item.task_id}` ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Copy Unblock Ask
                    </Button>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Wins */}
      {digest.quick_wins && digest.quick_wins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-success" />
              Quick Wins for Today
            </CardTitle>
            <CardDescription>Tasks that can be completed quickly with high impact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {digest.quick_wins.map((item) => (
                <div
                  key={item.task_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{item.task_name}</p>
                    <p className="text-sm text-muted-foreground">{item.impact}</p>
                  </div>
                  <Badge variant="outline" className="bg-success/10">
                    {item.estimated_time}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Dialog */}
      <Dialog open={!!templateDialog} onOpenChange={() => setTemplateDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {templateDialog?.type === "slack" ? (
                <MessageSquare className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              {templateDialog?.type === "slack" ? "Slack" : "Email"} Template
            </DialogTitle>
            <DialogDescription>To: {templateDialog?.recipient}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted font-mono text-sm whitespace-pre-wrap">
              {templateDialog?.message}
            </div>
            <Button
              className="w-full"
              onClick={() => {
                handleCopy(templateDialog?.message || "", "template");
                setTemplateDialog(null);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
