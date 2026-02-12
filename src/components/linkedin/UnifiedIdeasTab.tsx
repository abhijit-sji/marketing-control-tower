import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Sparkles, Loader2, Save, Lightbulb, TrendingUp } from "lucide-react";
import { usePerplexityResearch } from "@/hooks/usePerplexityResearch";
import { EnhancedTrendsList } from "./EnhancedTrendsList";
import { useToast } from "@/hooks/use-toast";
import type { WeeklyTrend } from "@/features/linkedin-content/types";

interface UnifiedIdeasTabProps {
  leaderId: string;
  leaderSlug: string;
  leaderName: string;
  trends: WeeklyTrend[];
  trendsLoading: boolean;
  onGenerateTrends: () => void;
  isGeneratingTrends: boolean;
}

export function UnifiedIdeasTab({
  leaderId,
  leaderSlug,
  leaderName,
  trends,
  trendsLoading,
  onGenerateTrends,
  isGeneratingTrends,
}: UnifiedIdeasTabProps) {
  const { toast } = useToast();
  const [researchTopic, setResearchTopic] = useState("");
  const researchMutation = usePerplexityResearch(leaderId);

  // Categorize trends by status
  const readyTrends = trends.filter((t) => (t as any).status === "ready");
  const draftTrends = trends.filter((t) => (t as any).status !== "ready" && (t as any).status !== "used");
  const usedTrends = trends.filter((t) => (t as any).status === "used");

  const handleResearch = async (saveToTrends = false) => {
    if (!researchTopic.trim()) {
      toast({ title: "Enter a topic to research", variant: "destructive" });
      return;
    }

    const result = await researchMutation.mutateAsync({
      topic: researchTopic,
      saveToTrends,
    });

    if (result.ok && saveToTrends) {
      setResearchTopic("");
      toast({ title: "Topic researched and saved!", description: "You can find it in the ideas below." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Quick Research */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ideas & Research</h2>
          <p className="text-sm text-muted-foreground">
            Research topics with AI and manage content ideas for {leaderName}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onGenerateTrends}
          disabled={isGeneratingTrends}
          className="shrink-0"
        >
          {isGeneratingTrends ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <TrendingUp className="mr-2 h-4 w-4" />
          )}
          Auto-Research Trends
        </Button>
      </div>

      {/* Quick Research Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" />
            Research a Topic
          </CardTitle>
          <CardDescription>
            Use Perplexity AI to research any topic and save it as a content idea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g., Latest trends in AI-powered sales automation..."
            value={researchTopic}
            onChange={(e) => setResearchTopic(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleResearch(true)}
              disabled={researchMutation.isPending || !researchTopic.trim()}
              className="gap-2"
            >
              {researchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Research & Save as Idea
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResearch(false)}
              disabled={researchMutation.isPending || !researchTopic.trim()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Research Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ideas List with Status Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <Lightbulb className="h-4 w-4" />
              All Ideas
              {trends.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {trends.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ready" className="gap-1.5">
              Ready
              {readyTrends.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {readyTrends.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="drafts" className="gap-1.5">
              Drafts
              {draftTrends.length > 0 && (
                <Badge variant="outline" className="ml-1">
                  {draftTrends.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          {trendsLoading || isGeneratingTrends ? (
            <LoadingState />
          ) : (
            <EnhancedTrendsList
              trends={trends.map((t) => ({
                ...t,
                status: (t as any).status,
                sourceUrl: (t as any).sourceUrl,
              }))}
              leaderId={leaderId}
              leaderSlug={leaderSlug}
              isMarketing={true}
            />
          )}
        </TabsContent>

        <TabsContent value="ready">
          {trendsLoading ? (
            <LoadingState />
          ) : readyTrends.length === 0 ? (
            <EmptyState
              message="No ideas marked as ready yet"
              hint="Use the dropdown menu on any idea to mark it as ready"
            />
          ) : (
            <EnhancedTrendsList
              trends={readyTrends.map((t) => ({
                ...t,
                status: (t as any).status,
                sourceUrl: (t as any).sourceUrl,
              }))}
              leaderId={leaderId}
              leaderSlug={leaderSlug}
              isMarketing={true}
            />
          )}
        </TabsContent>

        <TabsContent value="drafts">
          {trendsLoading ? (
            <LoadingState />
          ) : draftTrends.length === 0 ? (
            <EmptyState
              message="No draft ideas"
              hint="Research a topic above or auto-generate trends"
            />
          ) : (
            <EnhancedTrendsList
              trends={draftTrends.map((t) => ({
                ...t,
                status: (t as any).status,
                sourceUrl: (t as any).sourceUrl,
              }))}
              leaderId={leaderId}
              leaderSlug={leaderSlug}
              isMarketing={true}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading ideas…
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      <Sparkles className="mx-auto h-8 w-8 mb-3 opacity-50" />
      <p>{message}</p>
      <p className="mt-1 text-xs">{hint}</p>
    </div>
  );
}
