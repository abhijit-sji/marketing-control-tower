import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, TrendingUp, Sparkles, FileText, Bot, Search, Target, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface InternalAgentsPanelProps {
  brandId: string;
  brandName: string;
  brandSlug: string;
}

interface AIAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
}

const agentIcons: Record<string, React.ElementType> = {
  "data-strategist": TrendingUp,
  "content-strategist": Sparkles,
  "seo-blog-generator": FileText,
  "linkedin-content-gen": FileText,
  "keyword-research": Search,
  "brand-performance-optimization": TrendingUp,
  "hero-section-optimizer": Target,
  "reel-hook-generator": Video,
};

const agentColors: Record<string, string> = {
  "data-strategist": "from-blue-500 to-cyan-400",
  "content-strategist": "from-orange-500 to-amber-400",
  "seo-blog-generator": "from-green-500 to-emerald-400",
  "linkedin-content-gen": "from-indigo-500 to-purple-400",
  "keyword-research": "from-purple-500 to-pink-400",
  "brand-performance-optimization": "from-emerald-500 to-teal-400",
  "hero-section-optimizer": "from-rose-500 to-pink-400",
  "reel-hook-generator": "from-violet-500 to-fuchsia-400",
};

export function InternalAgentsPanel({ brandId, brandName, brandSlug }: InternalAgentsPanelProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["internal-agents", "brand"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, slug, description, category, is_enabled")
        .eq("scope", "brand")
        .eq("is_enabled", true)
        .order("name");
      
      if (error) throw error;
      return (data || []) as AIAgent[];
    },
  });

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRunAgent = (slug: string) => {
    if (slug === "seo-blog-generator") {
      navigate(`/brands/${brandSlug}/build-your-ai`);
    } else if (slug === "hero-section-optimizer") {
      navigate(`/brands/${brandSlug}/hero-section-optimizer`);
    } else if (slug === "reel-hook-generator") {
      navigate(`/brands/${brandSlug}/reel-hook-generator`);
    } else {
      // Navigate to dedicated agent page
      navigate(`/brands/${brandSlug}/${slug}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your AI Agents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>My AI Agents</CardTitle>
          </div>
          <CardDescription>
            Manage and interact with your AI agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assistants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Agent Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const Icon = agentIcons[agent.slug] || Bot;
              const colorClass = agentColors[agent.slug] || "from-gray-500 to-gray-400";

              return (
                <div
                  key={agent.id}
                  className="group p-4 rounded-lg border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass} shadow-sm`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{agent.name}</h4>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {agent.description || "AI-powered analysis and insights"}
                  </p>

                  <Badge variant="outline" className="text-[10px] mb-3">
                    {agent.category}
                  </Badge>

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleRunAgent(agent.slug)}
                  >
                    Use Agent
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
