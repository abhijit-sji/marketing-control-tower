import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, CheckCircle, AlertTriangle, XCircle, Timer, TrendingUp } from "lucide-react";
import { useTeamTasks, TeamTasksFilters } from "@/hooks/useTeamTasks";
import { PMDashboardFilters } from "@/components/tasks/PMDashboardFilters";
import { TaskStatusChart } from "@/components/tasks/TaskStatusChart";
import { TeamCompletionChart } from "@/components/tasks/TeamCompletionChart";
import { TeamMemberTaskCard } from "@/components/tasks/TeamMemberTaskCard";

export default function PMTaskDashboard() {
  const [filters, setFilters] = useState<TeamTasksFilters>({});
  const { data, isLoading, error } = useTeamTasks(filters);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Task Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of all team tasks grouped by assignee
          </p>
        </div>
      </div>

      {/* Filters */}
      <PMDashboardFilters filters={filters} onFiltersChange={setFilters} />

      {/* Error State */}
      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="py-6">
            <p className="text-red-600 dark:text-red-400">
              Failed to load team tasks. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <>
          {/* Stats Skeletons */}
          <div className="grid gap-4 md:grid-cols-5">
            {Array(5).fill(0).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Chart Skeletons */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-[250px]" /></CardContent>
            </Card>
            <Card>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-[250px]" /></CardContent>
            </Card>
          </div>
          {/* Team Grid Skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-12 w-full" /></CardHeader>
                <CardContent><Skeleton className="h-32 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Data Display */}
      {!isLoading && data && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <ListTodo className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalTeamTasks}</div>
                <p className="text-xs text-muted-foreground">
                  Across {data.teamMembers.length} team members
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalCompleted}</div>
                <p className="text-xs text-muted-foreground">
                  {data.averageCompletionRate}% avg completion
                </p>
              </CardContent>
            </Card>

            <Card className={data.totalOverdue > 0 ? 'border-red-200 dark:border-red-900' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${data.totalOverdue > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.totalOverdue > 0 ? 'text-red-500' : ''}`}>
                  {data.totalOverdue}
                </div>
                <p className="text-xs text-muted-foreground">
                  Past due date
                </p>
              </CardContent>
            </Card>

            <Card className={data.totalBlocked > 0 ? 'border-red-200 dark:border-red-900' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                <XCircle className={`h-4 w-4 ${data.totalBlocked > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.totalBlocked > 0 ? 'text-red-500' : ''}`}>
                  {data.totalBlocked}
                </div>
                <p className="text-xs text-muted-foreground">
                  Need attention
                </p>
              </CardContent>
            </Card>

            <Card className={data.totalStale > 0 ? 'border-orange-200 dark:border-orange-900' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stale</CardTitle>
                <Timer className={`h-4 w-4 ${data.totalStale > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.totalStale > 0 ? 'text-orange-500' : ''}`}>
                  {data.totalStale}
                </div>
                <p className="text-xs text-muted-foreground">
                  No update in 48h
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <TaskStatusChart data={data.statusDistribution} />
            <TeamCompletionChart data={data.teamMembers} />
          </div>

          {/* Team Members Grid */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Team Members</h2>
              <span className="text-muted-foreground text-sm">
                (sorted by problems first)
              </span>
            </div>

            {data.teamMembers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No team members have assigned tasks matching the current filters.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.teamMembers.map((member) => (
                  <TeamMemberTaskCard key={member.userId} member={member} />
                ))}
              </div>
            )}
          </div>

          {/* Members With No Tasks */}
          {data.membersWithNoTasks.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-muted-foreground mb-3">
                No Tasks Assigned ({data.membersWithNoTasks.length})
              </h2>
              <Card>
                <CardContent className="py-4">
                  <div className="flex flex-wrap gap-2">
                    {data.membersWithNoTasks.map((member) => (
                      <span
                        key={member.userId}
                        className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full"
                      >
                        {member.userName}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
