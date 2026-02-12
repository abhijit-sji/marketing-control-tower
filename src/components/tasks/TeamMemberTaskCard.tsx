import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, CheckCircle, Clock, AlertTriangle, XCircle, Timer, TrendingUp } from "lucide-react";
import { TeamMemberTaskStats } from "@/hooks/useTeamTasks";

interface TeamMemberTaskCardProps {
  member: TeamMemberTaskStats;
}

export function TeamMemberTaskCard({ member }: TeamMemberTaskCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/tasks?assignee=${member.userId}`);
  };

  const hasProblem = member.overdueCount > 0 || member.blockedTasks > 0 || member.staleCount > 0;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
        hasProblem ? 'border-red-200 dark:border-red-900' : ''
      }`}
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {member.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{member.userName}</h3>
              {member.userTitle && (
                <p className="text-xs text-muted-foreground truncate">{member.userTitle}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Workload</span>
            <p className="font-bold text-lg">{member.activeTasksCount}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Completion Rate Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-medium">{member.completionRate}%</span>
          </div>
          <Progress value={member.completionRate} className="h-2" />
        </div>

        {/* Task Counts Row */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs gap-1">
            <span className="font-semibold">{member.totalTasks}</span> total
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            {member.completedTasks}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            <Clock className="h-3 w-3" />
            {member.inProgressTasks}
          </Badge>
        </div>

        {/* Problem Badges */}
        {hasProblem && (
          <div className="flex flex-wrap gap-1.5">
            {member.overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                {member.overdueCount} Overdue
              </Badge>
            )}
            {member.blockedTasks > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <XCircle className="h-3 w-3" />
                {member.blockedTasks} Blocked
              </Badge>
            )}
            {member.staleCount > 0 && (
              <Badge className="text-xs gap-1 bg-orange-500 hover:bg-orange-600">
                <Timer className="h-3 w-3" />
                {member.staleCount} Stale
              </Badge>
            )}
          </div>
        )}

        {/* Footer: Velocity and Action */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{member.completedLast7Days} completed this week</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            View Tasks
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
