import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Bot, BookOpen, LineChart, Brain, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import AIAgentsSection from "@/components/ai-control/AIAgentsSection";
import AIKnowledgeSection from "@/components/ai-control/AIKnowledgeSection";
import AIMemorySection from "@/components/ai-control/AIMemorySection";
import AIAnalytics from "@/components/ai-control/AIAnalytics";

const AIControl = () => {
  const { user } = useAuth();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const role = user?.role ?? "user";
  const canManage = role === "super_admin" || role === "manager";
  const canViewAnalytics = role === "super_admin" || role === "manager";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/adminpanel">Admin Panel</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>AI Control</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-9 w-9 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Unified AI Control Panel</h1>
              <p className="text-sm text-muted-foreground">
                Manage agents, knowledge, and analytics from a single operational hub.
              </p>
            </div>
          </div>
          <Link to="/adminpanel/ai-control/streaming-test">
            <Button variant="outline" className="gap-2 whitespace-nowrap">
              <Sparkles className="h-4 w-4" />
              Test Streaming
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2" disabled={!canViewAnalytics}>
            <LineChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Memory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          {user?.id ? <AIAgentsSection userId={user.id} canManage={canManage} /> : null}
        </TabsContent>

        <TabsContent value="knowledge">
          <AIKnowledgeSection
            canManageSync={canManage}
            onSyncComplete={(timestamp) => setLastSyncAt(timestamp)}
          />
        </TabsContent>

        <TabsContent value="analytics">
          {canViewAnalytics ? (
            <AIAnalytics lastKnowledgeSync={lastSyncAt} />
          ) : (
            <div className="rounded-lg border border-dashed border-muted-foreground/40 p-12 text-center text-sm text-muted-foreground">
              Analytics are limited to managers and super administrators.
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory">
          <AIMemorySection canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIControl;
