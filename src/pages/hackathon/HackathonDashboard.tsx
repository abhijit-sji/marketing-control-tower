import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHackathonEvent, useParticipant, useEventTeams } from "@/hooks/useHackathon";
import { Users, Trophy, Calendar, Target } from "lucide-react";

export default function HackathonDashboard() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");

  const { data: event, isLoading: eventLoading } = useHackathonEvent(eventId || undefined);
  const { data: participant, isLoading: participantLoading } = useParticipant(eventId || undefined);
  const { data: teams } = useEventTeams(eventId || undefined);

  if (eventLoading || participantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!event || !participant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have access to this hackathon or haven't registered yet.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const myTeam = teams?.find(team => 
    team.team_members?.some((m: any) => m.participant?.id === participant.id)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">{event.title}</h1>
              <p className="text-muted-foreground">{event.description}</p>
            </div>
            <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
              {event.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Teams Formed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teams?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.max(0, Math.ceil((new Date(event.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Your Status</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{participant.status}</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Management
              </CardTitle>
              <CardDescription>
                {myTeam ? `You're part of ${myTeam.team_name}` : "Form or join a team"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myTeam ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-medium mb-2">Team Members:</p>
                    <div className="space-y-1">
                      {myTeam.team_members?.map((member: any) => (
                        <p key={member.id} className="text-sm text-muted-foreground">
                          {member.participant?.employee?.first_name} {member.participant?.employee?.last_name}
                        </p>
                      ))}
                    </div>
                  </div>
                  <Button asChild className="w-full">
                    <Link to={`/hackathon/submission?event=${eventId}&team=${myTeam.id}`}>
                      Submit Project
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button asChild className="w-full">
                  <Link to={`/hackathon/teams?event=${eventId}`}>
                    Find or Create Team
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Event Details
              </CardTitle>
              <CardDescription>Important dates and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Start Date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(event.start_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">End Date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(event.end_date).toLocaleDateString()}
                </p>
              </div>
              {event.registration_deadline && (
                <div>
                  <p className="text-sm font-medium">Registration Deadline</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.registration_deadline).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
