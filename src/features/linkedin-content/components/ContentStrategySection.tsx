import { LeaderNicheSettings } from "./LeaderNicheSettings";
import { WeeklyRhythmTracker } from "./WeeklyRhythmTracker";
import { QuickIdeaCapture } from "./QuickIdeaCapture";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Zap } from "lucide-react";

interface ContentStrategySectionProps {
  leaderId: string;
  leaderData: {
    niche_keyword?: string | null;
    niche_domain?: string | null;
    content_phase?: string | null;
    content_phase_start_date?: string | null;
    weekly_rhythm?: { teaching: number; opinion: number; how_to: number } | null;
    posts_this_week?: { teaching: number; opinion: number; how_to: number } | null;
    posts_week_start?: string | null;
  };
}

export const ContentStrategySection = ({ leaderId, leaderData }: ContentStrategySectionProps) => {
  const hasNicheConfigured = leaderData.niche_keyword && leaderData.niche_domain;

  return (
    <div className="space-y-6">
      {/* Quick Status Overview */}
      {hasNicheConfigured && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-medium">Niche:</span>
                <Badge variant="secondary">{leaderData.niche_keyword}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="font-medium">Domain:</span>
                <Badge variant="outline" className="capitalize">
                  {leaderData.niche_domain?.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="ml-auto">
                <QuickIdeaCapture leaderId={leaderId} variant="dialog" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Rhythm Tracker */}
      <WeeklyRhythmTracker
        leaderId={leaderId}
        weeklyRhythm={leaderData.weekly_rhythm || { teaching: 2, opinion: 1, how_to: 1 }}
        postsThisWeek={leaderData.posts_this_week || { teaching: 0, opinion: 0, how_to: 0 }}
        weekStart={leaderData.posts_week_start || null}
      />

      {/* Niche Settings Form */}
      <LeaderNicheSettings
        leaderId={leaderId}
        initialData={{
          niche_keyword: leaderData.niche_keyword,
          niche_domain: leaderData.niche_domain,
          content_phase: leaderData.content_phase,
          content_phase_start_date: leaderData.content_phase_start_date,
        }}
      />
    </div>
  );
};
