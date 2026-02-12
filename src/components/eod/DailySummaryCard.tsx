import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamDailySummary } from '@/hooks/useTeamSummaries';
import { CheckCircle2, Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface DailySummaryCardProps {
  summary: TeamDailySummary;
  onClick?: () => void;
}

export function DailySummaryCard({ summary, onClick }: DailySummaryCardProps) {
  const getProductivityColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProductivityLabel = (score: number | null) => {
    if (!score) return 'N/A';
    if (score >= 80) return 'Excellent';
    if (score >= 50) return 'Good';
    return 'Needs Attention';
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {summary.users?.first_name} {summary.users?.last_name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {summary.users?.title || summary.users?.department || 'Team Member'}
            </p>
          </div>
          {summary.productivity_score !== null && (
            <Badge className={getProductivityColor(summary.productivity_score)}>
              {getProductivityLabel(summary.productivity_score)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">{summary.tasks_completed}</p>
              <p className="text-xs text-muted-foreground">Tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm font-medium">{summary.hours_logged}h</p>
              <p className="text-xs text-muted-foreground">Hours</p>
            </div>
          </div>
        </div>

        {summary.key_accomplishments && summary.key_accomplishments.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium">
              <TrendingUp className="h-3 w-3" />
              Key Accomplishments
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {summary.key_accomplishments.slice(0, 2).map((accomplishment, i) => (
                <li key={i} className="line-clamp-1">• {accomplishment}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.concerns && summary.concerns.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-orange-600">
              <AlertCircle className="h-3 w-3" />
              Concerns
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {summary.concerns.slice(0, 2).map((concern, i) => (
                <li key={i} className="line-clamp-1">• {concern}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.ai_summary?.overall_summary && (
          <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
            {summary.ai_summary.overall_summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
