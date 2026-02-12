import { Bug, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatusCounts {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

interface FeedbackStatusOverviewProps {
  bugsByStatus: StatusCounts;
  featuresByStatus: StatusCounts;
}

const statusConfig = [
  { key: "open", label: "Open", color: "bg-orange-500" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-400" },
  { key: "resolved", label: "Resolved", color: "bg-green-500" },
  { key: "closed", label: "Closed", color: "bg-slate-400" },
] as const;

function StatusBars({
  title,
  icon: Icon,
  iconColor,
  counts,
}: {
  title: string;
  icon: typeof Bug;
  iconColor: string;
  counts: StatusCounts;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h3 className="flex items-center gap-2 font-medium mb-4">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {title} ({total})
      </h3>
      <div className="space-y-3">
        {statusConfig.map((status) => {
          const count = counts[status.key];
          const percentage = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={status.key} className="flex items-center gap-3">
              <span className="w-24 text-sm text-muted-foreground">{status.label}</span>
              <div className="flex-1 relative">
                <Progress value={percentage} className="h-2.5" />
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all ${status.color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-sm font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FeedbackStatusOverview({
  bugsByStatus,
  featuresByStatus,
}: FeedbackStatusOverviewProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Status Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <StatusBars
            title="Bug Reports"
            icon={Bug}
            iconColor="text-red-500"
            counts={bugsByStatus}
          />
          <StatusBars
            title="Feature Requests"
            icon={Lightbulb}
            iconColor="text-blue-500"
            counts={featuresByStatus}
          />
        </div>
      </CardContent>
    </Card>
  );
}
