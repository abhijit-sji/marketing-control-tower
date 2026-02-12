import { Bug, Lightbulb, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FeedbackStatsCardsProps {
  openBugs: number;
  openFeatures: number;
  inProgress: number;
  resolved: number;
  criticalBugs: number;
  highBugs: number;
  isLoading?: boolean;
}

export function FeedbackStatsCards({
  openBugs,
  openFeatures,
  inProgress,
  resolved,
  criticalBugs,
  highBugs,
  isLoading,
}: FeedbackStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border">
            <CardContent className="pt-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Open Bugs",
      value: openBugs,
      subtext: `Critical: ${criticalBugs} • High: ${highBugs}`,
      icon: Bug,
      bgClass: "bg-red-50 dark:bg-red-950/30",
      borderClass: "border-red-200 dark:border-red-900",
      iconClass: "text-red-500",
      valueClass: "text-red-600 dark:text-red-400",
    },
    {
      label: "Open Features",
      value: openFeatures,
      subtext: `Total requests: ${openFeatures}`,
      icon: Lightbulb,
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      borderClass: "border-blue-200 dark:border-blue-900",
      iconClass: "text-blue-500",
      valueClass: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "In Progress",
      value: inProgress,
      subtext: "Currently being worked on",
      icon: Clock,
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      borderClass: "border-amber-200 dark:border-amber-900",
      iconClass: "text-amber-500",
      valueClass: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Resolved",
      value: resolved,
      subtext: "Completed items",
      icon: CheckCircle2,
      bgClass: "bg-green-50 dark:bg-green-950/30",
      borderClass: "border-green-200 dark:border-green-900",
      iconClass: "text-green-500",
      valueClass: "text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`${stat.bgClass} ${stat.borderClass} border transition-all hover:shadow-md`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/50 dark:bg-black/20`}>
                <stat.icon className={`h-6 w-6 ${stat.iconClass}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground truncate">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.valueClass}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.subtext}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
