import { useState } from "react";
import { CONTENT_FUNNEL_STAGES, ContentFunnelStage } from "@/lib/content-funnel-data";
import { Eye, BookOpen, Target, DollarSign, Heart, ChevronRight, Lightbulb, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  BookOpen,
  Target,
  DollarSign,
  Heart,
};

interface ContentFunnelVisualizerProps {
  selectedStage?: string;
  onStageSelect?: (stageId: string) => void;
  compact?: boolean;
}

export function ContentFunnelVisualizer({ 
  selectedStage, 
  onStageSelect,
  compact = false 
}: ContentFunnelVisualizerProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(selectedStage || null);

  const handleStageClick = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
    onStageSelect?.(stageId);
  };

  const getWidthPercent = (index: number) => {
    const widths = [100, 85, 70, 55, 40];
    return widths[index];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Content Marketing Funnel</h3>
      </div>
      
      {/* Methodology Explainer */}
      {!compact && (
        <Card className="bg-muted/30 border-dashed mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium text-sm">Your Ideas + AI Research = High-Signal Content</p>
                <p className="text-xs text-muted-foreground">
                  Select a funnel stage below. The AI agent will help research and generate content, 
                  but the unique perspective and ideas come from <span className="font-semibold text-foreground">you</span>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel Visualization */}
      <div className="relative space-y-2">
        <TooltipProvider>
          {CONTENT_FUNNEL_STAGES.map((stage, index) => {
            const Icon = iconMap[stage.icon];
            const isSelected = selectedStage === stage.id;
            const isHovered = hoveredStage === stage.id;
            const isExpanded = expandedStage === stage.id;
            const widthPercent = getWidthPercent(index);

            return (
              <div key={stage.id} className="flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleStageClick(stage.id)}
                      onMouseEnter={() => setHoveredStage(stage.id)}
                      onMouseLeave={() => setHoveredStage(null)}
                      className={cn(
                        "relative transition-all duration-300 rounded-lg px-4 py-3 flex items-center gap-3",
                        "hover:shadow-md cursor-pointer border-2",
                        isSelected 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "border-transparent hover:border-primary/30",
                        isHovered && "scale-[1.02]"
                      )}
                      style={{ 
                        width: `${widthPercent}%`,
                        background: `linear-gradient(135deg, ${stage.color} 0%, ${stage.colorDark} 100%)`
                      }}
                    >
                      <Icon className="h-5 w-5 text-white shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-semibold text-white text-sm">
                          {stage.name}
                        </div>
                        <div className="text-white/80 text-xs truncate">
                          {stage.tagline}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-white/70 transition-transform shrink-0",
                        isExpanded && "rotate-90"
                      )} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">{stage.tagline}</p>
                    <p className="text-xs mt-1 italic">Click to see strategies & content types</p>
                  </TooltipContent>
                </Tooltip>

                {/* Expanded Details */}
                {isExpanded && (
                  <Card 
                    className="mt-2 mb-2 animate-in slide-in-from-top-2 duration-200"
                    style={{ width: `${widthPercent}%` }}
                  >
                    <CardContent className="p-4 space-y-4">
                      {/* Content Types */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Content Types
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {stage.postTypes.map((type) => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* KPIs */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Track These KPIs
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {stage.kpis.map((kpi) => (
                            <Badge key={kpi} variant="outline" className="text-xs">
                              {kpi}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Strategies */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Strategies
                        </h4>
                        <ul className="space-y-1">
                          {stage.strategies.map((strategy, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <Zap className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                              {strategy}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prompt Hint */}
                      <div className="pt-2 border-t">
                        <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-3">
                          <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-primary">Your Idea Prompt</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {stage.promptHint}
                            </p>
                          </div>
                        </div>
                      </div>

                      {onStageSelect && (
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => onStageSelect(stage.id)}
                        >
                          Create {stage.name} Content
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
