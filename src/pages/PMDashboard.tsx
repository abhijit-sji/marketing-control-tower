import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, FolderOpen, CheckCircle, Clock, Calendar, TrendingUp, Target, AlertTriangle, Building, User } from "lucide-react";

export default function PMDashboard() {
  // Mock PM data
  const pmStats = {
    totalClients: 8,
    activeProjects: 15,
    completedTasks: 142,
    teamMembers: 12,
    clientSatisfaction: 94,
    projectsOnTrack: 12,
    projectsAtRisk: 3
  };

  const recentClients = [
    {
      id: "1",
      name: "TechCorp Solutions",
      projects: 3,
      status: "active",
      lastContact: "2024-01-10",
      satisfaction: 95
    },
    {
      id: "2",
      name: "RetailPlus Inc",
      projects: 2,
      status: "active",
      lastContact: "2024-01-09",
      satisfaction: 88
    },
    {
      id: "3",
      name: "StartupXYZ",
      projects: 1,
      status: "pending",
      lastContact: "2024-01-08",
      satisfaction: 92
    }
  ];

  const activeProjects = [
    {
      id: "1",
      name: "Q4 Marketing Campaign",
      client: "TechCorp Solutions",
      progress: 75,
      status: "on_track",
      deadline: "2024-01-20",
      team: 4
    },
    {
      id: "2",
      name: "Website Redesign",
      client: "RetailPlus Inc",
      progress: 45,
      status: "at_risk",
      deadline: "2024-01-25",
      team: 6
    },
    {
      id: "3",
      name: "Social Media Strategy",
      client: "StartupXYZ",
      progress: 90,
      status: "ahead",
      deadline: "2024-01-15",
      team: 3
    }
  ];

  const teamPerformance = [
    {
      id: "1",
      name: "Sarah Johnson",
      role: "Senior Designer",
      tasksCompleted: 23,
      performance: 96,
      availability: "available"
    },
    {
      id: "2",
      name: "Michael Chen",
      role: "Developer",
      tasksCompleted: 18,
      performance: 89,
      availability: "busy"
    },
    {
      id: "3",
      name: "Emily Rodriguez",
      role: "Content Writer",
      tasksCompleted: 31,
      performance: 93,
      availability: "available"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'on_track': return 'bg-green-500';
      case 'at_risk': return 'bg-yellow-500';
      case 'ahead': return 'bg-blue-500';
      case 'pending': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on_track': return 'On Track';
      case 'at_risk': return 'At Risk';
      case 'ahead': return 'Ahead';
      case 'active': return 'Active';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'unavailable': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Project Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your clients, projects, and team performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmStats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              +2 new this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmStats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              {pmStats.projectsOnTrack} on track, {pmStats.projectsAtRisk} at risk
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmStats.teamMembers}</div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Satisfaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmStats.clientSatisfaction}%</div>
            <div className="mt-1">
              <Progress value={pmStats.clientSatisfaction} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +3% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Recent Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {client.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {client.projects} projects
                      </Badge>
                      <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {client.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{client.satisfaction}%</div>
                  <div className="text-xs text-muted-foreground">
                    Last contact: {new Date(client.lastContact).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              View All Clients
            </Button>
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeProjects.map((project) => (
              <div key={project.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.client}</p>
                  </div>
                  <Badge variant={
                    project.status === 'on_track' ? 'default' :
                    project.status === 'at_risk' ? 'destructive' : 'secondary'
                  }>
                    {getStatusText(project.status)}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{project.team} team members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Due {new Date(project.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              View All Projects
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teamPerformance.map((member) => (
              <div key={member.id} className="flex items-center space-x-3 p-4 rounded-lg bg-muted/50">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${getAvailabilityColor(member.availability)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {member.tasksCompleted} tasks
                    </span>
                    <span className="text-xs font-medium">
                      {member.performance}% performance
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Button variant="outline" className="justify-start">
              <Building className="h-4 w-4 mr-2" />
              Add New Client
            </Button>
            <Button variant="outline" className="justify-start">
              <FolderOpen className="h-4 w-4 mr-2" />
              Create Project
            </Button>
            <Button variant="outline" className="justify-start">
              <CheckCircle className="h-4 w-4 mr-2" />
              Assign Task
            </Button>
            <Button variant="outline" className="justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {pmStats.projectsAtRisk > 0 && (
        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-yellow-500/20">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  {pmStats.projectsAtRisk} Projects Need Attention
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Review the projects marked "At Risk" and take necessary actions to get them back on track.
                </p>
              </div>
              <Button variant="outline" className="ml-auto">
                Review Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}