import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  ExternalLink,
  CheckCircle2,
  Lightbulb,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";

interface AgentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: {
    name: string;
    slug: string;
    description: string;
    capabilities: string[];
    location: string;
    gradient: string;
    icon: ReactNode;
    route?: string;
    benefits?: string[];
    useCases?: string[];
  };
}

const AgentDetailModal = ({
  open,
  onOpenChange,
  agent,
}: AgentDetailModalProps) => {
  // Default benefits if not provided
  const benefits = agent.benefits || [
    "Save hours of manual work each week",
    "Consistent quality across all outputs",
    "Works 24/7 without breaks or delays",
    "Learns and improves from your feedback",
  ];

  // Default use cases if not provided
  const useCases = agent.useCases || [
    "Daily operational tasks and reporting",
    "Content creation and optimization",
    "Data analysis and insights generation",
    "Client communication drafting",
  ];

  // Map locations to routes
  const getRouteFromLocation = (location: string): string | undefined => {
    const locationRoutes: Record<string, string> = {
      "Control Tower": "/control-tower",
      "Brand Pages": "/brands",
      "Client Pages": "/clients",
      Global: "/workspace",
    };
    return agent.route || locationRoutes[location];
  };

  const agentRoute = getRouteFromLocation(agent.location);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          {/* Agent header */}
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center shadow-lg`}
            >
              {agent.icon}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-semibold text-foreground">
                {agent.name}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  AI Agent
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {agent.location}
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">
              About this Agent
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {agent.description}
            </p>
          </div>

          <Separator />

          {/* Capabilities */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Capabilities
            </h3>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Where to Find It */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Where to Find It
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              This agent is available in <strong>{agent.location}</strong>
            </p>
            {agentRoute && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                <Link to={agentRoute}>
                  Go There
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <Separator />

          {/* Why Use This Agent */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Why Use This Agent
            </h3>
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Use Cases */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Common Use Cases
            </h3>
            <ul className="space-y-2">
              {useCases.map((useCase, index) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/30"
                >
                  {useCase}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AgentDetailModal;
