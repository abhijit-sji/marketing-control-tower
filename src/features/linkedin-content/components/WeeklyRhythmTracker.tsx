import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, BookOpen, MessageSquare, Wrench, CheckCircle2 } from "lucide-react";
import { startOfWeek, format, isThisWeek } from "date-fns";

interface WeeklyRhythmTrackerProps {
  leaderId: string;
  postsThisWeek: {
    teaching: number;
    opinion: number;
    how_to: number;
  };
  weeklyRhythm: {
    teaching: number;
    opinion: number;
    how_to: number;
  };
  weekStart?: string | null;
}

const POST_TYPES = [
  { 
    key: "teaching" as const, 
    label: "Teaching Posts", 
    icon: BookOpen,
    description: "Educational content about your niche",
    color: "text-blue-600"
  },
  { 
    key: "opinion" as const, 
    label: "Opinion Posts", 
    icon: MessageSquare,
    description: "Your perspective with reasoning",
    color: "text-purple-600"
  },
  { 
    key: "how_to" as const, 
    label: "How-To Posts", 
    icon: Wrench,
    description: "Practical, actionable guides",
    color: "text-amber-600"
  },
];

export const WeeklyRhythmTracker = ({ 
  leaderId, 
  postsThisWeek, 
  weeklyRhythm,
  weekStart 
}: WeeklyRhythmTrackerProps) => {
  const queryClient = useQueryClient();
  
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const needsReset = !weekStart || !isThisWeek(new Date(weekStart), { weekStartsOn: 1 });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("thought_leaders")
        .update({
          posts_this_week: { teaching: 0, opinion: 0, how_to: 0 },
          posts_week_start: currentWeekStart.toISOString().split("T")[0],
        } as any)
        .eq("id", leaderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Weekly rhythm reset");
      queryClient.invalidateQueries({ queryKey: ["thought-leader", leaderId] });
    },
    onError: (error) => {
      toast.error("Failed to reset: " + error.message);
    },
  });

  const totalPosts = postsThisWeek.teaching + postsThisWeek.opinion + postsThisWeek.how_to;
  const totalTarget = weeklyRhythm.teaching + weeklyRhythm.opinion + weeklyRhythm.how_to;
  const overallProgress = totalTarget > 0 ? Math.round((totalPosts / totalTarget) * 100) : 0;

  const isComplete = 
    postsThisWeek.teaching >= weeklyRhythm.teaching &&
    postsThisWeek.opinion >= weeklyRhythm.opinion &&
    postsThisWeek.how_to >= weeklyRhythm.how_to;

  // Calculate suggested next post type
  const getSuggestedType = () => {
    const gaps = POST_TYPES.map(type => ({
      ...type,
      gap: weeklyRhythm[type.key] - postsThisWeek[type.key]
    })).sort((a, b) => b.gap - a.gap);

    return gaps[0]?.gap > 0 ? gaps[0] : null;
  };

  const suggested = getSuggestedType();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Weekly Content Rhythm</CardTitle>
            <CardDescription>
              Week of {format(currentWeekStart, "MMM d, yyyy")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-reset notice */}
        {needsReset && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-200 text-sm">
            <strong>New Week!</strong> The rhythm counter should be reset for the current week.
          </div>
        )}

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{totalPosts} / {totalTarget} posts</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Individual Post Types */}
        <div className="space-y-4">
          {POST_TYPES.map((type) => {
            const current = postsThisWeek[type.key] || 0;
            const target = weeklyRhythm[type.key] || 0;
            const progress = target > 0 ? Math.round((current / target) * 100) : 0;
            const isTypeComplete = current >= target;
            const isSuggested = suggested?.key === type.key;

            return (
              <div key={type.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <type.icon className={`h-4 w-4 ${type.color}`} />
                    <span className="text-sm font-medium">{type.label}</span>
                    {isSuggested && (
                      <Badge variant="outline" className="text-xs">
                        Suggested Next
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {current} / {target}
                    </span>
                    {isTypeComplete && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
                <Progress 
                  value={Math.min(progress, 100)} 
                  className="h-1.5" 
                />
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            );
          })}
        </div>

        {/* Suggestion */}
        {suggested && !isComplete && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm">
              <strong>Recommendation:</strong> Create a <strong>{suggested.label.toLowerCase().replace(" posts", "")}</strong> post next to maintain rhythm balance.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};