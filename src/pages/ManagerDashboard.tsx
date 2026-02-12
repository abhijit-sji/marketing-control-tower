import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Bot, Wrench, Building2, Target, TrendingUp, DollarSign, Clock, AlertCircle, CheckCircle, Zap, Award, Loader2 } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManagerDashboard() {
  const { 
    teamMembers, 
    brandPerformance, 
    totalUsers, 
    activeBrands, 
    totalRevenue, 
    teamEfficiency,
    loading, 
    error 
  } = useDashboardData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="max-w-2xl">
        <AlertDescription>
          Error loading dashboard data: {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate manager stats from real data
  const managerStats = {
    totalTeam: teamMembers.length,
    activeAgents: Math.round(activeBrands * 1.5), // Assume 1.5 agents per brand on average
    toolsAvailable: 18,
    brandsManaged: activeBrands,
    monthlyRevenue: totalRevenue,
    teamEfficiency,
    activeTasks: teamMembers.reduce((sum, member) => sum + member.tasksCompleted * 0.3, 0),
    completedTasks: teamMembers.reduce((sum, member) => sum + member.tasksCompleted, 0)
  };

  const aiAgentsStatus = [
    {
      id: "1",
      name: "Content Generator",
      type: "Content Creation",
      status: "active",
      performance: 94,
      tasksCompleted: 156
    },
    {
      id: "2",
      name: "Analytics Assistant",
      type: "Data Analysis",
      status: "active",
      performance: 89,
      tasksCompleted: 89
    },
    {
      id: "3",
      name: "Social Media Bot",
      type: "Social Management",
      status: "training",
      performance: 76,
      tasksCompleted: 45
    }
  ];

  const teamHighlights = [
    {
      id: "1",
      name: "Sarah Johnson",
      role: "Senior Project Manager",
      achievement: "Completed 5 projects ahead of schedule",
      performance: 98,
      trend: "up"
    },
    {
      id: "2",
      name: "Michael Chen",
      role: "Marketing Specialist",
      achievement: "Increased client satisfaction by 15%",
      performance: 91,
      trend: "up"
    },
    {
      id: "3",
      name: "Emily Rodriguez",
      role: "Content Creator",
      achievement: "Generated 200+ pieces of content",
      performance: 88,
      trend: "stable"
    }
  ];

  // Use real brand performance data
  const brandPerformanceData = brandPerformance.slice(0, 6);

  const recentActions = [
    {
      id: "1",
      action: "New AI Agent deployed for Brand A",
      type: "ai_deployment",
      timestamp: "2024-01-10T10:30:00Z",
      impact: "high"
    },
    {
      id: "2",
      action: "Team member Sarah promoted to Senior PM",
      type: "team_update",
      timestamp: "2024-01-09T14:15:00Z",
      impact: "medium"
    },
    {
      id: "3",
      action: "Q4 performance review completed",
      type: "review",
      timestamp: "2024-01-08T16:45:00Z",
      impact: "high"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'growing': return 'bg-green-500';
      case 'training': case 'stable': return 'bg-yellow-500';
      case 'declining': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down': return <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />;
      default: return <Target className="h-3 w-3 text-gray-600" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of team performance, AI agents, and business metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managerStats.totalTeam}</div>
            <p className="text-xs text-muted-foreground">
              Across {managerStats.brandsManaged} brands
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Agents Active</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{managerStats.activeAgents}</div>
            <p className="text-xs text-muted-foreground">
              {managerStats.toolsAvailable} tools available
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${(managerStats.monthlyRevenue / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              +8% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Efficiency</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managerStats.teamEfficiency}%</div>
            <div className="mt-1">
              <Progress value={managerStats.teamEfficiency} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +4% improvement
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Agents Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Agents Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiAgentsStatus.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`} />
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{agent.performance}%</div>
                  <div className="text-xs text-muted-foreground">
                    {agent.tasksCompleted} tasks completed
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              Manage AI Agents
            </Button>
          </CardContent>
        </Card>

        {/* Team Highlights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Team Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamHighlights.map((member) => (
              <div key={member.id} className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{member.name}</p>
                    {getTrendIcon(member.trend)}
                  </div>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                  <p className="text-xs text-green-600 mt-1">{member.achievement}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    Performance: {member.performance}%
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              View Team Performance
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Brand Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Brand Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {brandPerformanceData.map((brand) => (
              <div key={brand.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{brand.name}</h3>
                  <Badge variant={
                    brand.status === 'growing' ? 'default' :
                    brand.status === 'declining' ? 'destructive' : 'secondary'
                  }>
                    {brand.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Revenue</span>
                    <span className="text-sm font-medium">
                      ${(brand.revenue / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Growth</span>
                    <span className={`text-sm font-medium ${
                      brand.growth > 0 ? 'text-green-600' : 
                      brand.growth < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {brand.growth > 0 ? '+' : ''}{brand.growth.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active Tasks</span>
                    <span className="text-sm font-medium">{brand.activeTasks}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Task Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-600">{managerStats.completedTasks}</div>
                <div className="text-sm text-green-700 dark:text-green-300">Completed</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="text-2xl font-bold text-blue-600">{managerStats.activeTasks}</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Active</div>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline" className="w-full">
                View All Tasks
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActions.map((action) => (
              <div key={action.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{action.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(action.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs ${getImpactColor(action.impact)}`}>
                  {action.impact}
                </Badge>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              View Activity Log
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Button variant="outline" className="justify-start">
              <Bot className="h-4 w-4 mr-2" />
              Deploy AI Agent
            </Button>
            <Button variant="outline" className="justify-start">
              <Users className="h-4 w-4 mr-2" />
              Review Team
            </Button>
            <Button variant="outline" className="justify-start">
              <Building2 className="h-4 w-4 mr-2" />
              Brand Analysis
            </Button>
            <Button variant="outline" className="justify-start">
              <Target className="h-4 w-4 mr-2" />
              Set Goals
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}