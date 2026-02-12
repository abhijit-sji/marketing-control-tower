// ================================================
// Control Tower - Meetings Page
// ================================================

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useZoomMeetings } from "@/hooks/useZoomMeetings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Video, Loader2, AlertCircle, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

export default function MeetingsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search to avoid too many API calls
  const handleSearchChange = (value: string) => {
    setSearch(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1); // Reset to first page on new search
    }, 500);
    return () => clearTimeout(timer);
  };

  const { data, isLoading, error } = useZoomMeetings({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Meeting Recordings</CardTitle>
              <CardDescription>
                View all Zoom meeting recordings from Control Tower
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meetings by topic, project, or client..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Meetings</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="font-mono text-sm">{error.message}</p>
                <div className="mt-3 text-xs space-y-1">
                  <p className="font-semibold">Troubleshooting:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verify Control Tower environment variables are set in Supabase Edge Functions secrets</li>
                    <li>Check that CONTROL_TOWER_API_URL points to /functions/v1</li>
                    <li>Ensure CONTROL_TOWER_API_KEY is set to a valid API key</li>
                    <li>Test the API directly with curl to verify access</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading meetings...</span>
            </div>
          ) : data?.meetings && data.meetings.length > 0 ? (
            <>
              {/* Meetings Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meeting Topic</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.meetings.map((meeting) => (
                      <TableRow key={meeting.id}>
                        <TableCell className="font-medium">
                          {meeting.title}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(meeting.start_time)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">N/A</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">N/A</span>
                        </TableCell>
                        <TableCell className="max-w-md">
                          {meeting.description ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {meeting.description}
                            </p>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No summary available</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {meeting.meeting_link && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <a
                                href={meeting.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing page {data.page} of {data.totalPages} ({data.total} total meetings)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search ? 'No meetings found matching your search.' : 'No meetings found.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
