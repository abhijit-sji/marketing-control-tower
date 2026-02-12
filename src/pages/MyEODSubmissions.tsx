import { useAuth } from '@/hooks/useAuth';
import { useEODSubmissions } from '@/hooks/useTeamSummaries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ExternalLink, StickyNote, FileText, TrendingUp } from 'lucide-react';
import { format, differenceInDays, startOfToday, startOfMonth } from 'date-fns';
import { useState, useMemo } from 'react';

export default function MyEODSubmissions() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const { data: submissions = [], isLoading } = useEODSubmissions(user?.id);

  const filteredSubmissions = useMemo(() => {
    const now = new Date();
    const today = startOfToday();
    
    return submissions.filter(submission => {
      const submissionDate = new Date(submission.submission_date);
      const daysDiff = differenceInDays(today, submissionDate);
      
      switch (dateRange) {
        case 'today':
          return daysDiff === 0;
        case 'week':
          return daysDiff <= 7;
        case 'month':
          return daysDiff <= 30;
        case 'all':
        default:
          return true;
      }
    });
  }, [submissions, dateRange]);

  // Statistics
  const stats = useMemo(() => {
    const thisMonth = submissions.filter(s => {
      const submissionDate = new Date(s.submission_date);
      return submissionDate >= startOfMonth(new Date());
    });

    const totalTasks = filteredSubmissions.reduce((sum, s) => sum + (s.task_links?.length || 0), 0);
    const avgTasks = filteredSubmissions.length > 0 ? (totalTasks / filteredSubmissions.length).toFixed(1) : '0';
    
    const lastSubmission = submissions.length > 0 
      ? format(new Date(submissions[0].submission_date), 'MMM dd, yyyy')
      : 'No submissions yet';

    return {
      thisMonth: thisMonth.length,
      avgTasks,
      lastSubmission,
      totalSubmissions: filteredSubmissions.length,
    };
  }, [submissions, filteredSubmissions]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My EOD Submissions</h1>
        <p className="text-muted-foreground mt-2">
          View and track your daily EOD reports
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">Total submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Tasks/Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgTasks}</div>
            <p className="text-xs text-muted-foreground">Selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shown</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">In selected range</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Submission</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">{stats.lastSubmission}</div>
            <p className="text-xs text-muted-foreground">Most recent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Submissions</CardTitle>
          <CardDescription>Select a time range to view your EOD reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={dateRange === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('today')}
            >
              Today
            </Button>
            <Button
              variant={dateRange === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('week')}
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRange === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('month')}
            >
              Last 30 Days
            </Button>
            <Button
              variant={dateRange === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('all')}
            >
              All Time
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Display */}
      <Card>
        <CardHeader>
          <CardTitle>Your Submissions</CardTitle>
          <CardDescription>
            {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-pulse">Loading submissions...</div>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No submissions found</p>
              <p className="text-sm mt-2">Try selecting a different time range</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubmissions.map((submission) => (
                <Card key={submission.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold text-lg">
                          {format(new Date(submission.submission_date), 'EEEE, MMMM dd, yyyy')}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {submission.task_links?.length || 0} task{submission.task_links?.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {submission.task_links && submission.task_links.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <ExternalLink className="h-4 w-4" />
                          Task Links:
                        </p>
                        <div className="space-y-1 pl-5">
                          {submission.task_links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
                            >
                              <span className="text-muted-foreground">#{idx + 1}</span>
                              {link}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {submission.notes && (
                      <div className="space-y-2 mb-4 bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <StickyNote className="h-4 w-4" />
                          Notes:
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{submission.notes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
                      <Clock className="h-3 w-3" />
                      Submitted on {format(new Date(submission.created_at), 'MMM dd, yyyy')} at {format(new Date(submission.created_at), 'h:mm a')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
