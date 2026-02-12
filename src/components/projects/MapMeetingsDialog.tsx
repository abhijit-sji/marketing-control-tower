import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, Loader2, Search, Link as LinkIcon } from 'lucide-react';
import { controlTowerAPI, Meeting } from '@/lib/controlTowerApi';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface MapMeetingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMapMeeting: (meeting: Meeting) => void;
  mappedMeetingIds: string[];
  projectId?: string;
}

export function MapMeetingsDialog({
  open,
  onOpenChange,
  onMapMeeting,
  mappedMeetingIds,
  projectId,
}: MapMeetingsDialogProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (open) {
      fetchMeetings();
    }
  }, [open, page, searchQuery]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      // Don't filter by project_id - show all meetings so users can map any meeting to this project
      const response = await controlTowerAPI.getMeetings({
        page,
        limit: 20,
        search: searchQuery || undefined,
      });
      setMeetings(response.meetings || []);
      setTotalPages(response.pagination?.total_pages || 1);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
      toast.error('Failed to load meetings from Control Tower');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page on search
  };

  const handleMapMeeting = (meeting: Meeting) => {
    onMapMeeting(meeting);
  };

  const isMeetingMapped = (meetingId: string) => {
    return mappedMeetingIds.includes(meetingId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Map Meetings to Project</DialogTitle>
          <DialogDescription>
            Select meetings from Control Tower to map to this project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Meetings List */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading meetings...</span>
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No meetings found</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {meetings.map((meeting) => {
                  const mapped = isMeetingMapped(meeting.id);

                  return (
                    <div
                      key={meeting.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{meeting.title}</h3>
                            {meeting.meeting_type && (
                              <Badge variant="outline" className="text-xs">
                                {meeting.meeting_type}
                              </Badge>
                            )}
                            {mapped && (
                              <Badge variant="secondary" className="text-xs">
                                Mapped
                              </Badge>
                            )}
                          </div>

                          {meeting.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {meeting.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(meeting.start_time), 'MMM d, yyyy')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                            </div>
                            {meeting.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {meeting.location}
                              </div>
                            )}
                            {meeting.organizer && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {meeting.organizer}
                              </div>
                            )}
                            {meeting.meeting_link && (
                              <div className="flex items-center gap-1">
                                <LinkIcon className="h-3 w-3" />
                                <a
                                  href={meeting.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Join
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleMapMeeting(meeting)}
                          disabled={mapped}
                        >
                          {mapped ? 'Mapped' : 'Map'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
