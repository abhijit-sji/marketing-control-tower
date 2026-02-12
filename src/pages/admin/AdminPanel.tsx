import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Building2, 
  Settings,
  BarChart3,
  Plug,
  Bot,
  Target,
  ArrowRight,
  Shield,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const AdminPanel = () => {
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Team Management",
      description: "Manage all team members and marketing assignments",
      icon: Users,
      href: "/adminpanel/team",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950"
    },
    {
      title: "EOD Review",
      description: "Review daily team performance and submissions",
      icon: Target,
      href: "/adminpanel/eod-review",
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950"
    },
    {
      title: "Brand Management", 
      description: "Configure brands, KPIs, and brand settings",
      icon: Building2,
      href: "/adminpanel/brands",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950"
    },
    {
      title: "Integration Hub",
      description: "Manage AI integrations and external services",
      icon: Plug,
      href: "/adminpanel/integrations", 
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950"
    },
    {
      title: "KPI Configuration",
      description: "Set up and monitor key performance indicators",
      icon: TrendingUp,
      href: "/adminpanel/kpis",
      color: "text-orange-500", 
      bgColor: "bg-orange-50 dark:bg-orange-950"
    },
    {
      title: "AI Dashboard",
      description: "Monitor AI agents and automation performance",
      icon: Bot,
      href: "/adminpanel/ai-dashboard",
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-950"
    },
    {
      title: "LinkedIn AI Config",
      description: "Manage LinkedIn AI agent prompts and knowledge base",
      icon: MessageSquare,
      href: "/adminpanel/linkedin-agent-config",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950"
    },
    {
      title: "System Settings",
      description: "Configure system-wide settings and preferences", 
      icon: Settings,
      href: "/adminpanel/settings",
      color: "text-gray-500",
      bgColor: "bg-gray-50 dark:bg-gray-950"
    }
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">
            Complete administrative control and system management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Super Admin Access
          </Badge>
        </div>
      </div>

      {/* Welcome Message */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                Welcome back, Super Admin!
              </h3>
              <p className="text-muted-foreground">
                You have full administrative access to all system features and user data. 
                Use the navigation menu or quick actions below to manage the platform.
              </p>
            </div>
            <Button asChild variant="outline">
              <NavLink to="/" className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Back to Dashboard
              </NavLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Administrative Functions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card key={action.title} className="group hover:shadow-md transition-shadow cursor-pointer">
              <NavLink to={action.href}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-md ${action.bgColor}`}>
                      <action.icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <CardTitle className="text-base">{action.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {action.description}
                  </CardDescription>
                </CardHeader>
              </NavLink>
            </Card>
          ))}
        </div>
      </div>


      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">Active</div>
              <div className="text-sm text-muted-foreground">System Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">All Users</div>
              <div className="text-sm text-muted-foreground">Access Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">Latest</div>
              <div className="text-sm text-muted-foreground">Version</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">24/7</div>
              <div className="text-sm text-muted-foreground">Monitoring</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;