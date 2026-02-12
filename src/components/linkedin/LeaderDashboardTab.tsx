import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Wand2, TrendingUp, FileText, Sparkles, CheckCircle2, ArrowRight, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WeeklyTrend, GeneratedPost } from "@/features/linkedin-content/types";
import { useState } from "react";

interface LeaderDashboardTabProps {
  leaderName: string;
  leaderSlug: string;
  leaderId: string;
  trends: WeeklyTrend[];
  posts: GeneratedPost[];
  analyticsSummary?: {
    totalPosts: number;
    avgEngagement: number;
    avgImpressions: number;
  } | null;
  onGeneratePost: (customIdea?: string) => void;
  onOpenTrend: (trend: WeeklyTrend) => void;
}

export function LeaderDashboardTab({
  leaderName,
  leaderSlug,
  leaderId,
  trends,
  posts,
  analyticsSummary,
  onGeneratePost,
  onOpenTrend,
}: LeaderDashboardTabProps) {
  const navigate = useNavigate();
  const [quickIdea, setQuickIdea] = useState("");

  // Filter ready topics
  const readyTopics = trends.filter((t) => (t as any).status === "ready");
  const recentDrafts = posts.slice(0, 3);

  const handleQuickGenerate = () => {
    if (quickIdea.trim()) {
      onGeneratePost(quickIdea);
      setQuickIdea("");
    } else {
      onGeneratePost();
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-muted-foreground">
          Here's what's ready for {leaderName}'s LinkedIn content
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{readyTopics.length}</div>
                <p className="text-xs text-muted-foreground">Ready Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50">
                <Lightbulb className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{trends.length}</div>
                <p className="text-xs text-muted-foreground">Total Ideas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{posts.length}</div>
                <p className="text-xs text-muted-foreground">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {analyticsSummary?.avgEngagement || "—"}
                </div>
                <p className="text-xs text-muted-foreground">Avg Engagement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Generate */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Generate
          </CardTitle>
          <CardDescription>
            Start with a custom idea or generate from your ready topics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="What would you like to write about? (optional)"
              value={quickIdea}
              onChange={(e) => setQuickIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickGenerate()}
              className="flex-1"
            />
            <Button onClick={handleQuickGenerate} className="gap-2">
              <Wand2 className="h-4 w-4" />
              Generate Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ready Topics */}
      {readyTopics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Ready to Generate</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/content/linkedin/${leaderSlug}?tab=ideas`)}
                className="gap-1"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Topics marked as ready for content generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {readyTopics.slice(0, 3).map((trend) => (
                <div
                  key={trend.id}
                  className="group cursor-pointer rounded-lg border p-4 transition-colors hover:border-primary hover:bg-primary/5"
                  onClick={() => onOpenTrend(trend)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm line-clamp-2">{trend.topicTitle}</h4>
                    <Badge variant="default" className="shrink-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Ready
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {typeof trend.topicSummary === "string" &&
                    trend.topicSummary.startsWith("{")
                      ? JSON.parse(trend.topicSummary)?.topic_summary?.slice(0, 100) + "..."
                      : trend.topicSummary?.slice(0, 100) + "..."}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Wand2 className="h-3 w-3" />
                    Generate Post
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Drafts */}
      {recentDrafts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Drafts</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/content/linkedin/${leaderSlug}?tab=drafts`)}
                className="gap-1"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDrafts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{post.postTitle}</h4>
                    <p className="text-xs text-muted-foreground">
                      {post.generatedAt &&
                        formatDistanceToNow(new Date(post.generatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize shrink-0">
                    {post.sourceType}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {readyTopics.length === 0 && recentDrafts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">Get Started</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Research trending topics in the Ideas tab or generate a post from a custom idea above.
            </p>
            <Button onClick={() => navigate(`/content/linkedin/${leaderSlug}?tab=ideas`)}>
              <Lightbulb className="mr-2 h-4 w-4" />
              Explore Ideas
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
