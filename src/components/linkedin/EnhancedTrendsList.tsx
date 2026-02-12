import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Check, CheckCircle2, Clock, Edit, Loader2, MoreVertical, Sparkles, Trash2, Wand2, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUpdateTrendStatus, useDeleteTrend } from "@/hooks/usePerplexityResearch";
import { useToast } from "@/hooks/use-toast";
import { parseTopicSummary, cleanCitations } from "@/lib/parseResearchBrief";

interface WeeklyTrend {
  id: string;
  leaderId: string;
  weekStart: string;
  topicTitle: string;
  topicSummary: string;
  relevanceScore: number | null;
  createdAt: string;
  status?: string;
  sourceUrl?: string;
}

interface EnhancedTrendsListProps {
  trends: WeeklyTrend[];
  leaderId: string;
  leaderSlug: string;
  isMarketing?: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "secondary", icon: Edit },
  ready: { label: "Ready", variant: "default", icon: CheckCircle2 },
  in_progress: { label: "In Progress", variant: "outline", icon: Clock },
  used: { label: "Used", variant: "secondary", icon: Check },
};

export function EnhancedTrendsList({ trends, leaderId, leaderSlug, isMarketing = true }: EnhancedTrendsListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const updateStatusMutation = useUpdateTrendStatus(leaderId);
  const deleteMutation = useDeleteTrend(leaderId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (trends.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Sparkles className="mx-auto h-8 w-8 mb-3 opacity-50" />
        <p>No topic ideas yet.</p>
        <p className="mt-1 text-xs">Use the Research tab to find trending topics with Perplexity AI.</p>
      </div>
    );
  }

  const handleStatusChange = (trendId: string, newStatus: "draft" | "ready" | "in_progress" | "used") => {
    updateStatusMutation.mutate({ trendId, status: newStatus });
  };

  const handleDelete = (trendId: string) => {
    deleteMutation.mutate(trendId);
  };

  const handleGeneratePost = (trend: WeeklyTrend) => {
    navigate(`/content/linkedin/${leaderSlug}/generate`, {
      state: {
        defaultSource: {
          sourceType: "trend",
          sourceId: trend.id,
          customContent: trend.topicSummary,
          headlineIdea: trend.topicTitle,
        },
      },
    });
  };

  const handleCopy = async (trend: WeeklyTrend) => {
    const text = `${trend.topicTitle}\n\n${trend.topicSummary}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(trend.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {trends.map((trend) => {
        const status = (trend.status as keyof typeof statusConfig) || "draft";
        const config = statusConfig[status] || statusConfig.draft;
        const StatusIcon = config.icon;

        return (
          <Card key={trend.id} className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-lg leading-tight">{trend.topicTitle}</CardTitle>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    Week of {trend.weekStart}
                    {trend.createdAt && (
                      <>
                        <span>·</span>
                        {formatDistanceToNow(new Date(trend.createdAt), { addSuffix: true })}
                      </>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isMarketing && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(trend.id, "ready")}
                            disabled={status === "ready"}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Mark as Ready
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(trend.id, "draft")}
                            disabled={status === "draft"}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Back to Draft
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => handleCopy(trend)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Topic
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleGeneratePost(trend)}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate Post
                      </DropdownMenuItem>
                      {isMarketing && (
                        <>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this topic?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{trend.topicTitle}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(trend.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {(() => {
                const { isJson, data } = parseTopicSummary(trend.topicSummary);

                if (isJson && data) {
                  return (
                    <div className="space-y-3">
                      {/* Summary */}
                      <p className="leading-relaxed">{cleanCitations(data.topic_summary)}</p>

                      {/* Key Points */}
                      {data.key_points && data.key_points.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-1.5 text-foreground">Key Points</h4>
                          <ul className="space-y-1.5">
                            {data.key_points.slice(0, 3).map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{cleanCitations(point)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Content Angles */}
                      {data.content_angles && data.content_angles.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-1.5 text-foreground">Content Angles</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {data.content_angles.slice(0, 3).map((angle, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {angle.angle}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Trending Aspects */}
                      {data.trending_aspects && data.trending_aspects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {data.trending_aspects.slice(0, 4).map((aspect, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {cleanCitations(aspect.split('[')[0].trim())}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                // Fallback: plain text sentence splitting
                const sentences = trend.topicSummary
                  .split(/[.!?]\s+/)
                  .filter((s) => s.trim().length > 0)
                  .map((s) => s.trim());

                if (sentences.length <= 1) {
                  return <p className="leading-relaxed">{trend.topicSummary}</p>;
                }

                return (
                  <ul className="space-y-2 text-sm">
                    {sentences.slice(0, 4).map((sentence, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{sentence}</span>
                      </li>
                    ))}
                    {sentences.length > 4 && (
                      <li className="text-xs text-muted-foreground/70">
                        +{sentences.length - 4} more points...
                      </li>
                    )}
                  </ul>
                );
              })()}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {trend.relevanceScore !== null && (
                    <Badge variant="outline" className="text-xs">
                      Score: {trend.relevanceScore.toFixed(0)}
                    </Badge>
                  )}
                  {trend.sourceUrl && (
                    <Badge variant="outline" className="text-xs">
                      Has Source
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleGeneratePost(trend)}
                  className="gap-1"
                >
                  {copiedId === trend.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Generate Post
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
