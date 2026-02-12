import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIBusinessConfiguration } from "@/components/ai/AIBusinessConfiguration";
import { AIModelConfiguration } from "@/components/ai/AIModelConfiguration";
import { AIAgentRunner } from "@/components/ai/AIAgentRunner";
import { useAIAgents } from "@/hooks/useLatestAIAgentRun";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Settings, BarChart3 } from "lucide-react";

export default function AIDashboard() {
  const { data: agents = [], isLoading } = useAIAgents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Dashboard</h1>
        <p className="text-muted-foreground">
          Manage AI agents and configure intelligent analysis for your business
        </p>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Agents
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Available AI Agents</h2>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-20 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : agents.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {agents.map((agent) => (
                  <AIAgentRunner
                    key={agent.id}
                    agentId={agent.id}
                    agentName={agent.name}
                    agentDescription={agent.description || ''}
                    category={agent.category}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No AI Agents Available</h3>
                  <p className="text-muted-foreground">
                    AI agents will appear here once they're configured and enabled.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AIBusinessConfiguration />
            <AIModelConfiguration />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Usage Analytics</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Analytics Coming Soon</h3>
              <p className="text-muted-foreground">
                View AI agent performance, usage statistics, and insights here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}