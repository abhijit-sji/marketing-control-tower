import { useState } from 'react';
import { useTeamSummaries, useEODSubmissionStatus } from '@/hooks/useTeamSummaries';
import { DailySummaryCard } from '@/components/eod/DailySummaryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Users, CheckCircle, Clock, TrendingUp, Database, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TeamDailySummary } from '@/hooks/useTeamSummaries';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PeopleReviewDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSummary, setSelectedSummary] = useState<TeamDailySummary | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);
  
  const { data: summaries, isLoading, refetch } = useTeamSummaries(selectedDate);
  const { data: submissionStatus } = useEODSubmissionStatus(selectedDate);
  const { toast } = useToast();

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-sample-eod-data');
      
      if (error) throw error;
      
      toast({
        title: "Sample data seeded successfully",
        description: `Created ${data.data.tasks} tasks, ${data.data.eod_submissions} EOD submissions, and ${data.data.summaries} summaries`,
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Error seeding data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleGenerateSummaries = async () => {
    setIsGeneratingSummaries(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-eod-summary', {
        body: { date: selectedDate.toISOString().split('T')[0] }
      });
      
      if (error) throw error;
      
      toast({
        title: "AI summaries generated",
        description: `Generated ${data.summaries_generated} summaries`,
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Error generating summaries",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummaries(false);
    }
  };

  const averageProductivity = summaries?.length
    ? summaries.reduce((acc, s) => acc + (s.productivity_score || 0), 0) / summaries.length
    : 0;

  const totalTasksCompleted = summaries?.reduce((acc, s) => acc + s.tasks_completed, 0) || 0;
  const totalHoursLogged = summaries?.reduce((acc, s) => acc + s.hours_logged, 0) || 0;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team EOD Review Dashboard</h1>
          <p className="text-muted-foreground">
            Review team performance and daily EOD submissions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSeedData}
            disabled={isSeeding}
          >
            <Database className="mr-2 h-4 w-4" />
            {isSeeding ? 'Seeding...' : 'Seed Sample Data'}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleGenerateSummaries}
            disabled={isGeneratingSummaries}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isGeneratingSummaries ? 'Generating...' : 'Generate AI Summaries'}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submissionStatus?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {submissionStatus?.submitted || 0} submitted EOD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EOD Submission Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissionStatus?.total 
                ? Math.round((submissionStatus.submitted / submissionStatus.total) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {submissionStatus?.pending || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Productivity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageProductivity.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              {totalTasksCompleted} tasks completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursLogged.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              Logged today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Summaries */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Team Summaries</h2>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading summaries...
          </div>
        ) : summaries && summaries.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((summary) => (
              <DailySummaryCard
                key={summary.id}
                summary={summary}
                onClick={() => setSelectedSummary(summary)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <div className="space-y-4">
                <p>No summaries available for {format(selectedDate, 'PPP')}</p>
                <p className="text-sm">
                  Team members need to submit their EOD reports, or you can seed sample data for testing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSummary?.users?.first_name} {selectedSummary?.users?.last_name}
            </DialogTitle>
            <DialogDescription>
              {selectedSummary?.summary_date 
                ? format(new Date(selectedSummary.summary_date), 'PPPP')
                : 'Date not available'
              }
            </DialogDescription>
          </DialogHeader>

          {selectedSummary && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Badge variant={selectedSummary.productivity_score && selectedSummary.productivity_score >= 80 ? 'default' : 'secondary'}>
                  Productivity: {selectedSummary.productivity_score || 'N/A'}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {selectedSummary.tasks_completed} tasks • {selectedSummary.hours_logged}h logged
                </div>
              </div>

              {selectedSummary.ai_summary?.overall_summary && (
                <div>
                  <h3 className="font-semibold mb-2">AI Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSummary.ai_summary.overall_summary}
                  </p>
                </div>
              )}

              {selectedSummary.key_accomplishments && selectedSummary.key_accomplishments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Key Accomplishments</h3>
                  <ul className="space-y-1">
                    {selectedSummary.key_accomplishments.map((accomplishment, i) => (
                      <li key={i} className="text-sm">• {accomplishment}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSummary.concerns && selectedSummary.concerns.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-orange-600">Concerns</h3>
                  <ul className="space-y-1">
                    {selectedSummary.concerns.map((concern, i) => (
                      <li key={i} className="text-sm">• {concern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSummary.ai_summary?.recommendations && selectedSummary.ai_summary.recommendations.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Manager Recommendations</h3>
                  <ul className="space-y-1">
                    {selectedSummary.ai_summary.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="text-sm">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSummary.ai_summary?.hours_analysis && (
                <div>
                  <h3 className="font-semibold mb-2">Hours Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSummary.ai_summary.hours_analysis}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
