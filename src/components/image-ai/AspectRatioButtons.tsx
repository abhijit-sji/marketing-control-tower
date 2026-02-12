import { cn } from "@/lib/utils";
import {
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Monitor,
  Smartphone,
  PanelLeftOpen,
  PanelTopOpen,
  Check,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AspectRatio {
  id: string;
  name: string;
  width: number;
  height: number;
  display_label: string;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
  cost_multiplier: number;
}

interface AspectRatioButtonsProps {
  ratios: AspectRatio[];
  selectedRatio: string;
  onSelect: (ratioName: string) => void;
  disabled?: boolean;
  showCost?: boolean;
  baseCostCents?: number;
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Monitor,
  Smartphone,
  PanelLeftOpen,
  PanelTopOpen,
};

export function AspectRatioButtons({
  ratios,
  selectedRatio,
  onSelect,
  disabled = false,
  showCost = false,
  baseCostCents = 3.9,
}: AspectRatioButtonsProps) {
  const sortedRatios = [...ratios].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {sortedRatios.map((ratio) => {
          const IconComponent = iconMap[ratio.icon_name || "Square"] || Square;
          const cost = (baseCostCents * ratio.cost_multiplier).toFixed(1);
          const isSelected = selectedRatio === ratio.name;

          return (
            <Tooltip key={ratio.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => !disabled && onSelect(ratio.name)}
                  disabled={disabled}
                  className={cn(
                    "flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[70px] rounded-md border transition-all relative",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-input hover:bg-accent hover:text-accent-foreground",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 border-2 border-background">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <IconComponent className="w-5 h-5" />
                  <span className="text-xs font-medium">{ratio.display_label.split(" ")[0]}</span>
                  {showCost && (
                    <span className={cn("text-[10px]", isSelected ? "opacity-80" : "opacity-60")}>{cost}c</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-center">
                  <p className="font-medium">{ratio.display_label}</p>
                  <p className="text-xs text-muted-foreground">
                    {ratio.width} x {ratio.height}
                  </p>
                  {showCost && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{cost} cents per image
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Compact dropdown version
export function AspectRatioSelect({
  ratios,
  selectedRatio,
  onSelect,
  disabled = false,
}: AspectRatioButtonsProps) {
  const sortedRatios = [...ratios].sort((a, b) => a.sort_order - b.sort_order);
  const selected = sortedRatios.find((r) => r.name === selectedRatio);

  return (
    <select
      value={selectedRatio}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {sortedRatios.map((ratio) => (
        <option key={ratio.id} value={ratio.name}>
          {ratio.display_label} ({ratio.width}x{ratio.height})
        </option>
      ))}
    </select>
  );
}

// Visual preview of aspect ratio
export function AspectRatioPreview({
  ratio,
  className,
}: {
  ratio: AspectRatio | undefined;
  className?: string;
}) {
  if (!ratio) return null;

  // Calculate preview dimensions (max 100px)
  const maxSize = 100;
  const aspectRatio = ratio.width / ratio.height;
  let previewWidth: number;
  let previewHeight: number;

  if (aspectRatio >= 1) {
    previewWidth = maxSize;
    previewHeight = maxSize / aspectRatio;
  } else {
    previewHeight = maxSize;
    previewWidth = maxSize * aspectRatio;
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className="border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center text-[10px] text-muted-foreground"
        style={{
          width: previewWidth,
          height: previewHeight,
        }}
      >
        {ratio.width}x{ratio.height}
      </div>
    </div>
  );
}
