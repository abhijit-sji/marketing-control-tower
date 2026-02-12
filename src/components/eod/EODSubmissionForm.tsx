import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubmitEOD } from '@/hooks/useTeamSummaries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X, History } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function EODSubmissionForm() {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());
  const [taskLinks, setTaskLinks] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const submitEOD = useSubmitEOD();

  const addTaskLink = () => {
    setTaskLinks([...taskLinks, '']);
  };

  const removeTaskLink = (index: number) => {
    setTaskLinks(taskLinks.filter((_, i) => i !== index));
  };

  const updateTaskLink = (index: number, value: string) => {
    const newLinks = [...taskLinks];
    newLinks[index] = value;
    setTaskLinks(newLinks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLinks = taskLinks.filter(link => link.trim() !== '');
    
    if (validLinks.length === 0) {
      toast.error('Please add at least one task link');
      return;
    }

    try {
      await submitEOD.mutateAsync({
        submission_date: format(date, 'yyyy-MM-dd'),
        task_links: validLinks,
        notes: notes.trim() || undefined,
      });

      toast.success('EOD submitted successfully!', {
        action: {
          label: 'View History',
          onClick: () => navigate('/dashboard/my-eod-submissions'),
        },
      });
      setTaskLinks(['']);
      setNotes('');
    } catch (error) {
      toast.error('Failed to submit EOD');
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit End of Day Report</CardTitle>
        <CardDescription>
          Record your completed tasks and notes for the day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Task Links (ActiveCollab URLs)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addTaskLink}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </Button>
            </div>
            {taskLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="https://activecollab.com/..."
                  value={link}
                  onChange={(e) => updateTaskLink(index, e.target.value)}
                />
                {taskLinks.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTaskLink(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context or notes about your day..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitEOD.isPending}
          >
            {submitEOD.isPending ? 'Submitting...' : 'Submit EOD'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => navigate('/dashboard/my-eod-submissions')}
        >
          <History className="h-4 w-4 mr-2" />
          View My EOD History
        </Button>
      </CardFooter>
    </Card>
  );
}
