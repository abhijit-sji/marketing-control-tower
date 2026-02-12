import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  category?: string;
  type?: string;
  is_enabled?: boolean;
}

export function AgentGrid({
  agents,
  onTry
}: {
  agents: Agent[];
  onTry: (agent: Agent) => void;
}) {
  if (!agents?.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No agents found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map(agent => (
        <Card key={agent.id} className="relative hover:shadow-lg transition-shadow">
          <CardContent className="p-6 space-y-4">
            {/* Header with icon */}
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-lg leading-tight">{agent.name}</h3>

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {agent.description}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <span>🎯</span>
                <span>{agent.category || "General"}</span>
              </Badge>
            </div>

            {/* Action Button */}
            <Button 
              onClick={() => onTry(agent)} 
              className="w-full"
            >
              Use Agent
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
