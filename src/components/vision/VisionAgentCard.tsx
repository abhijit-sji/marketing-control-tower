import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, MapPin, ChevronRight } from "lucide-react";
import VisionAgentDemoDialog from "./VisionAgentDemoDialog";
import AgentDetailModal from "./AgentDetailModal";
import type { VisionExample } from "@/hooks/useVisionExamples";

interface VisionAgentCardProps {
  name: string;
  slug: string;
  description: string;
  capabilities: string[];
  location: string;
  gradient: string;
  icon: React.ReactNode;
  example?: VisionExample;
}

const VisionAgentCard = ({
  name,
  slug,
  description,
  capabilities,
  location,
  gradient,
  icon,
  example,
}: VisionAgentCardProps) => {
  const [showDemo, setShowDemo] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const handleCardClick = () => {
    setShowDetail(true);
  };

  const handleExampleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDemo(true);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group relative overflow-hidden rounded-2xl bg-card border border-border p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 cursor-pointer"
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">{name}</h3>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{location}</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{description}</p>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-2 mb-4">
          {capabilities.slice(0, 3).map((cap, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>

        {/* Action */}
        {example && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleExampleClick}
          >
            <Eye className="mr-2 h-4 w-4" />
            See Example
          </Button>
        )}
      </div>

      {/* Demo Dialog */}
      {example && (
        <VisionAgentDemoDialog
          open={showDemo}
          onOpenChange={setShowDemo}
          example={example}
          gradient={gradient}
          icon={icon}
        />
      )}

      {/* Detail Modal */}
      <AgentDetailModal
        open={showDetail}
        onOpenChange={setShowDetail}
        agent={{
          name,
          slug,
          description,
          capabilities,
          location,
          gradient,
          icon,
        }}
      />
    </>
  );
};

export default VisionAgentCard;
