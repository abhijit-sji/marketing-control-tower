import { Bot } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MyAgentsPanel } from "@/components/agents/MyAgentsPanel";

export default function MyAgentsPage() {
  const { user } = useAuth();

  if (!user?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            My AI Agents
          </h1>
          <p className="text-muted-foreground">
            Please sign in to access your AI agents
          </p>
        </div>
      </div>
    );
  }

  return <MyAgentsPanel userId={user.id} showHeader={true} />;
}
